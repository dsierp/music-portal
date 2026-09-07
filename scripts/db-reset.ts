/**
 * Odtworzenie lokalnej bazy PGlite od zera: npm run db:reset
 *
 * PGlite trzyma dane w zwykłym katalogu i potrafi się rozsypać, gdy proces
 * zostanie ubity w trakcie zapisu (albo gdy dwa procesy piszą naraz). Objaw:
 * `RuntimeError: Aborted()` przy starcie albo "Failed query: ..." na każdej
 * stronie, która czyta bazę.
 *
 * Ten skrypt NIE KASUJE starych danych — odsuwa katalog na bok
 * (data/pglite-corrupt-<timestamp>), żeby dało się do niego wrócić, po czym
 * uruchamia migracje i import danych od nowa. Konta i oceny z popsutej bazy
 * przepadają, ale w praktyce i tak nie dało się ich odczytać.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const url = process.env.DATABASE_URL ?? "";
if (url && !url.startsWith("pglite:")) {
  console.error("DATABASE_URL wskazuje na prawdziwy Postgres — ten skrypt dotyczy tylko lokalnej PGlite.");
  process.exit(1);
}
const dir = path.resolve(url.replace(/^pglite:/, "") || "./data/pglite");
const lockPath = `${dir}.lock`;

if (fs.existsSync(dir)) {
  const backup = `${dir}-corrupt-${Math.floor(Date.now() / 1000)}`;
  fs.renameSync(dir, backup);
  console.log(`Stara baza odsunięta na bok: ${backup}`);
  console.log("(gdy nowa ruszy i nie będzie Ci potrzebna, możesz ten katalog skasować ręcznie)");
} else {
  console.log(`Brak katalogu ${dir} — tworzę bazę od zera.`);
}
if (fs.existsSync(lockPath)) fs.rmSync(lockPath, { force: true });

function run(args: string[]) {
  console.log(`\n> npm run ${args.join(" ")}`);
  const r = spawnSync("npm", ["run", ...args], { stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) {
    console.error(
      "\nNie udało się. Jeśli błąd to znowu RuntimeError: Aborted() na PUSTEJ bazie,\n" +
        "problem jest w samej instalacji PGlite — spróbuj: rm -rf node_modules && npm install",
    );
    process.exit(r.status ?? 1);
  }
}

run(["db:migrate"]);
run(["import:pns", "--", "data/purenewshit.html"]);
console.log("\nGotowe. Odpal `npm run dev`.");
