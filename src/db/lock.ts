/**
 * Blokada katalogu PGlite między procesami.
 *
 * PGlite to Postgres w WASM zapisywany do katalogu — obsługuje DOKŁADNIE JEDEN
 * proces naraz. Dwa procesy na tym samym katalogu (np. `npm run dev` zawieszony
 * przez Ctrl+Z, który wciąż żyje, plus świeży `npm run db:migrate`) kończą się
 * `RuntimeError: Aborted()`, a w gorszym przypadku rozwaloną bazą do odtworzenia.
 *
 * PGlite pisze własny postmaster.pid, ale z PID-em z WASM (np. "-42"), więc nie
 * da się z niego sprawdzić, czy ktoś naprawdę trzyma katalog. Dlatego trzymamy
 * własny plik <katalog>.lock z PRAWDZIWYM PID-em procesu Node.
 *
 * Zamek jest samonaprawialny: jeśli w pliku jest PID procesu, który już nie żyje
 * (np. po `kill -9`), po prostu go nadpisujemy. Blokujemy tylko wtedy, gdy drugi
 * proces faktycznie żyje — a to jest właśnie przypadek, który psuł bazę.
 */
import fs from "node:fs";
import path from "node:path";

export class PgliteLockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PgliteLockedError";
  }
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    // EPERM = proces istnieje, tylko należy do kogoś innego
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

interface LockInfo {
  pid: number;
  since: string;
  cmd: string;
}

function readLock(lockPath: string): LockInfo | null {
  try {
    const [pid, since, cmd] = fs.readFileSync(lockPath, "utf8").split("\n");
    const n = Number(pid);
    if (!Number.isInteger(n) || n <= 0) return null;
    return { pid: n, since: since ?? "?", cmd: cmd ?? "?" };
  } catch {
    return null;
  }
}

/**
 * Zajmuje katalog dla tego procesu albo rzuca PgliteLockedError z instrukcją,
 * co zrobić. Zwalnia zamek przy normalnym wyjściu i na Ctrl+C.
 */
export function acquirePgliteLock(dir: string): void {
  // Next.js (dev i build) odpala procesy-workery, które też importują ten moduł.
  // To wciąż JEDNO uruchomienie aplikacji, więc nie mogą blokować się nawzajem —
  // zamek trzyma proces-rodzic (scripts/dev.ts), a dzieci dziedziczą tę zmienną
  // środowiskową i zamek pomijają.
  if (process.env.PGLITE_LOCK_OWNER) return;
  if (process.env.NEXT_PHASE?.includes("build")) return;
  if (process.env.PGLITE_SKIP_LOCK === "1") return;

  const lockPath = `${path.normalize(dir).replace(/[/\\]+$/, "")}.lock`;
  const held = readLock(lockPath);
  if (held && held.pid !== process.pid && isAlive(held.pid)) {
    throw new PgliteLockedError(
      [
        `Baza ${dir} jest już używana przez inny proces (PID ${held.pid}).`,
        `  uruchomiony: ${held.since}`,
        `  komenda:     ${held.cmd}`,
        "",
        "PGlite obsługuje tylko jeden proces naraz — drugi potrafi rozwalić dane.",
        "Co zrobić:",
        `  • używaj tamtego procesu, albo go zamknij: kill ${held.pid}`,
        "  • pamiętaj: Ctrl+Z tylko WSTRZYMUJE serwer (dalej trzyma bazę) — kończy go Ctrl+C",
        "  • jeśli na pewno nic nie działa: usuń plik " + lockPath,
      ].join("\n"),
    );
  }

  try {
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });
    fs.writeFileSync(lockPath, `${process.pid}\n${new Date().toISOString()}\n${process.argv.slice(1).join(" ")}\n`);
    // Procesy potomne (workery Next.js) mają pomijać zamek — to samo uruchomienie.
    process.env.PGLITE_LOCK_OWNER = String(process.pid);
  } catch {
    return; // katalog tylko do odczytu itp. — brak zamka nie może blokować pracy
  }

  const release = () => {
    const cur = readLock(lockPath);
    if (cur?.pid === process.pid) {
      try {
        fs.unlinkSync(lockPath);
      } catch {
        /* ignore */
      }
    }
  };
  process.once("exit", release);
  for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
    process.once(sig, () => {
      release();
      process.exit(0);
    });
  }
}
