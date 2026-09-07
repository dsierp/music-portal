import { chromium } from "playwright";
const base = "http://localhost:3000";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await b.newPage({ viewport: { width: 1280, height: 900 } });
const log = (...a) => console.log("•", ...a);
/** Klik w przycisk server action: czekamy na POST i przerender. */
const act = async (sel) => {
  await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), page.click(sel)]);
  await page.waitForTimeout(700);
};
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));

await page.goto(base + "/login");
await page.fill('input[name=email]', "dominik@example.com");
await page.click('text=Wejdź');
await page.waitForURL(base + "/");
log("zalogowany:", await page.textContent("header"));

// preferencje
await page.goto(base + "/ja");
await act('button:has-text("black metal")');
await act('button:has-text("progressive rock")');
await page.fill('input[name=genre]:not([type=hidden])', "zeuhl");
await act('button:has-text("Dodaj")');
// waga 5 dla black metal
const form = page.locator('form', { has: page.locator('input[name=genre][value="black metal"]') }).first();
await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), form.locator('button[value="5"]').click()]);
await page.waitForTimeout(700);
log("style:", (await page.locator('#style .card li').allTextContents()).map(t => t.replace(/\s+/g, " ").trim()));

// album: ocena, komentarz, lubię
await page.goto(base + "/album/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
log("album h1:", await page.textContent("h1"));
log("skład:", (await page.locator('section:has(h2:text("Skład")) li').allTextContents()).map(t=>t.replace(/\s+/g," ").trim()));
await act('form[action] button[name=score][value="9"]');
await page.fill('textarea[name=body]', "Najlepszy Sigh od lat. Shamisen!");
await act('button:has-text("Dodaj komentarz")');
await act('button:has-text("Lubię tę płytę")');
log("oceny:", (await page.textContent('section:has(h3:text("Oceny"))')).replace(/\s+/g," ").slice(0,120));
log("komentarze:", (await page.textContent('section:has(h3:text("Komentarze"))')).replace(/\s+/g," ").slice(0,160));
log("lubię:", await page.textContent('button:has-text("Lubisz")'));
// odpowiedź na komentarz
await page.click('summary:has-text("odpowiedz")');
await page.fill('form:has(input[name=parentId]) textarea', "Zgadzam się.");
await act('form:has(input[name=parentId]) button');
log("komentarze po odpowiedzi:", await page.locator('section:has(h3:text("Komentarze")) li').count(), "li");

// podróż: klik w muzyka
await page.click('section:has(h2:text("Skład")) a:has-text("Mirai Kawashima")');
await page.waitForURL(/artist\/22222222/);
log("artysta:", await page.textContent("h1"), "|", (await page.locator('section:has(h2:text("Grał(a)")) .display').allTextContents()));
await act('button:has-text("Do ulubionych")');
log("ulubiony:", await page.textContent('button:has-text("Ulubiony")'));
await act('button[name=score][value="8"]');

// zespół
await page.click('section:has(h2:text("Zespoły")) a:has-text("Sigh")');
await page.waitForURL(/artist\/11111111/);
log("zespół skład:", (await page.locator('section:has(h2:text("Skład")) li').allTextContents()).map(t=>t.replace(/\s+/g," ").trim()));
log("albumy:", await page.locator('section:has(h2:text("Albumy")) .display').allTextContents());

// premiery → go/release → album
await page.goto(base + "/premiery");
log("premiery filtr z preferencji:", await page.locator('aside').textContent().then(t=>t.includes("Filtr z Twoich preferencji")));
await page.goto(base + "/premiery?all=1");
await page.click('a:has-text("Sigh – Goh-Ka")');
await page.waitForURL(/album\/aaaaaaaa/);
log("premiera → album OK");

// listy + profil
await page.goto(base + "/listy");
log("listy:", (await page.locator('.card ol li').allTextContents()).map(t=>t.replace(/\s+/g," ").trim()));
await page.goto(base + "/ja");
log("moje oceny:", (await page.locator('#oceny li').allTextContents()).map(t=>t.replace(/\s+/g," ").trim()));
log("lubiane:", await page.locator('#plyty li').count());
await page.screenshot({ path: "/tmp/ja.png", fullPage: true });
await page.goto(base + "/album/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
await page.screenshot({ path: "/tmp/album.png", fullPage: true });
await page.goto(base + "/");
await page.screenshot({ path: "/tmp/home.png", fullPage: true });
await page.goto(base + "/artist/22222222-2222-4222-8222-222222222222");
await page.screenshot({ path: "/tmp/artist.png", fullPage: true });
await b.close();
