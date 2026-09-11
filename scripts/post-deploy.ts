/**
 * Import premier zaraz po zbudowaniu na Vercelu: wołany z `buildCommand`
 * w vercel.json, czyli `npm run build && npx tsx scripts/post-deploy.ts`.
 *
 * Skąd się wziął: odświeżanie premier chodziło z maca — ktoś musiał w piątek
 * pamiętać, żeby zapisać stronę Pure New Shit i puścić `import:pns` na Neona.
 * Plik w repo sam z siebie nic nie zmienia, bo portal czyta premiery z bazy,
 * nie z dysku. Ten krok domyka łańcuch: zadanie w tle podmienia w piątek
 * `data/purenewshit.html` i pushuje do `main`, Vercel buduje, a tu plik
 * wjeżdża do bazy. Nikt niczego nie klika.
 *
 * DLACZEGO TYLKO PRODUKCJA: na podglądzie gałęzi `VERCEL_ENV` to "preview",
 * a preview i produkcja mają tę samą bazę. Robocza gałąź nie ma prawa
 * przestawiać tego, co widzą ludzie na stronie.
 *
 * DLACZEGO BUILD MA PAŚĆ, GDY IMPORT PADNIE: cichy błąd oznacza stronę sprzed
 * tygodnia i zero sygnału — dokładnie to, co się już raz zdarzyło. Nieudany
 * build wysyła maila, a na antenie zostaje poprzedni, działający deploy.
 *
 * Import jest idempotentny (sekcje nadpisywane po id), więc kolejne deploye
 * tego samego tygodnia niczego nie duplikują.
 */
import { spawnSync } from "node:child_process";

const PLIK = "data/purenewshit.html";

const env = process.env.VERCEL_ENV;
if (env && env !== "production") {
  console.log(`post-deploy: VERCEL_ENV=${env} — pomijam import, do bazy pisze tylko produkcja.`);
  process.exit(0);
}

// Build lokalny (`npm run build` na maszynie) nie ma adresu bazy produkcyjnej
// i nie powinien niczego importować.
if (!process.env.DATABASE_URL) {
  console.log("post-deploy: brak DATABASE_URL — pomijam import (to nie jest build produkcyjny).");
  process.exit(0);
}

console.log(`post-deploy: wczytuję ${PLIK} do bazy…`);
const r = spawnSync("npm", ["run", "import:pns", "--", PLIK], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (r.status !== 0) {
  console.error(
    [
      "",
      "post-deploy: import się nie udał — przerywam build.",
      "Na antenie zostaje poprzedni deploy, więc portal działa dalej, tylko z danymi sprzed tego pushu.",
      "Najczęstsze przyczyny: baza nie przyjmuje połączeń (limit Neona) albo schemat jest starszy niż kod",
      "(wtedy `npm run neon:setup -- --tylko-migracje`).",
    ].join("\n"),
  );
  process.exit(r.status ?? 1);
}

console.log("post-deploy: premiery są w bazie. Dowiązuję MBID…");

/**
 * Dowiązanie do MusicBrainz OD RAZU, a nie przy pierwszym kliknięciu.
 *
 * Bez tego świeżo zaimportowane pozycje mają puste `mbid`, więc kliknięcie
 * w tytuł uruchamia pytanie do MusicBrainz w locie. MusicBrainz przepuszcza
 * jedno zapytanie na sekundę, a przy nieudanej próbie link leci do
 * wyszukiwarki — i to jest dokładnie to, co widać jako „wchodzę w płytę,
 * a ląduję w szukajce".
 *
 * Budżet czasowy, bo build nie może stać dziesięciu minut: premiery idą
 * pierwsze, best of dostaje resztę czasu, a czego nie zdążymy — dowiąże się
 * przy kliknięciu, jak dotąd.
 *
 * Ten krok NIE przerywa builda. Nieudane dowiązanie to gorsze linki, a nie
 * zepsuta strona; import premier już się udał i to on jest tu istotny.
 */
const d = spawnSync("npm", ["run", "resolve:mbids", "--", "--minuty=6"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
if (d.status !== 0) {
  console.warn("post-deploy: dowiązywanie MBID się nie udało — linki dowiążą się przy kliknięciu. Build leci dalej.");
}

console.log("post-deploy: gotowe.");
