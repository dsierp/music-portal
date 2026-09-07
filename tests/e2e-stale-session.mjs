/**
 * Odtwarza sytuację po `npm run db:reset`: ciasteczko z sesją (JWT) zostaje,
 * ale wiersz użytkownika w bazie znika. Odczyty działają, więc wygląda się na
 * zalogowanego — i dopiero ocena wywalała stronę na błąd klucza obcego.
 *
 * Dwa przebiegi (między nimi trzeba zatrzymać serwer i skasować użytkownika,
 * bo PGlite nie znosi dwóch procesów naraz):
 *   MODE=login node tests/e2e-stale-session.mjs   → loguje się, ocenia, zapisuje ciasteczka
 *   MODE=check node tests/e2e-stale-session.mjs   → wraca z tymi ciasteczkami do martwego konta
 */
import { chromium } from "playwright";

const base = process.env.BASE ?? "http://localhost:3575";
const album = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const statePath = process.env.STATE ?? "/tmp/stale-state.json";
const mode = process.env.MODE ?? "login";
const log = (...a) => console.log("•", ...a);
let failed = false;
const check = (ok, msg) => { console.log(ok ? `  OK   ${msg}` : `  BŁĄD ${msg}`); if (!ok) failed = true; };

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const ctx = await b.newContext(mode === "check" ? { storageState: statePath } : {});
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
const crashed = () => page.locator("h1", { hasText: "Coś poszło nie tak" }).count();

if (mode === "login") {
  await page.goto(base + "/login");
  await page.fill("input[name=email]", "dominik@example.com");
  await page.click("text=Wejdź");
  await page.waitForTimeout(2500); // po zalogowaniu przekierowanie może iść na inny port — ciasteczko i tak jest ustawione dla localhost
  await page.goto(base + `/album/${album}`);
  check(!/zaloguj/i.test(((await page.textContent("header")) ?? "")), "po zalogowaniu header pokazuje konto");
  await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), page.click('form[action] button[name=score][value="9"]')]);
  await page.waitForTimeout(800);
  check((await crashed()) === 0, "ocena działa, dopóki użytkownik istnieje w bazie");
  await ctx.storageState({ path: statePath });
  log("ciasteczka zapisane:", statePath);
} else {
  await page.goto(base + `/album/${album}`);
  const header = ((await page.textContent("header")) ?? "").replace(/\s+/g, " ").trim();
  check((await crashed()) === 0, "strona płyty otwiera się mimo nieistniejącego konta");
  check(/zaloguj/i.test(header), `konto z martwej sesji traktowane jako wylogowane (header: „${header.slice(0, 70)}")`);
  check((await page.locator('button[name=score][value="9"]').count()) === 0, "formularz oceny nie jest pokazywany");
}

await b.close();
console.log(failed ? "\nSĄ BŁĘDY" : "\nOK");
process.exit(failed ? 1 : 0);
