/**
 * `npm run dev` — serwer deweloperski z zajęciem lokalnej bazy.
 *
 * Po co osobny skrypt zamiast gołego `next dev`: PGlite (baza w pliku) znosi
 * tylko jeden proces naraz. Dwa serwery na tym samym katalogu — albo serwer
 * wstrzymany Ctrl+Z (który wciąż żyje i trzyma bazę) plus `npm run db:migrate` —
 * kończą się `RuntimeError: Aborted()` i rozwaloną bazą do odtworzenia.
 *
 * Ten proces zajmuje katalog na czas swojego życia, a `next dev` odpala jako
 * dziecko: workery Next.js dziedziczą PGLITE_LOCK_OWNER i zamek pomijają
 * (to wciąż to samo uruchomienie), za to drugi `npm run dev` albo `db:migrate`
 * dostanie czytelny komunikat, zamiast po cichu psuć dane.
 *
 * Gdyby zamek kiedykolwiek przeszkadzał: `npm run dev:raw` omija go w całości.
 */
import "dotenv/config";
import { spawn } from "node:child_process";
import { usingPglite, pgliteDir } from "../src/db/paths";
import { acquirePgliteLock, PgliteLockedError } from "../src/db/lock";

if (usingPglite) {
  try {
    acquirePgliteLock(pgliteDir!);
  } catch (e) {
    if (e instanceof PgliteLockedError) {
      console.error(`\n${e.message}\n`);
      process.exit(1);
    }
    throw e;
  }
}

const args = process.argv.slice(2);
const child = spawn("npx", ["next", "dev", ...args], { stdio: "inherit", env: process.env, shell: process.platform === "win32" });

for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
  process.on(sig, () => child.kill(sig));
}
child.on("exit", (code, signal) => {
  process.exit(signal ? 1 : (code ?? 0));
});
