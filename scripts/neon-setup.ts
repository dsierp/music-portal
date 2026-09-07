/**
 * Napełnienie bazy w chmurze (Neon): npm run neon:setup
 *
 * Po co osobny skrypt: `DATABASE_URL` w .env przełącza CAŁY portal — wpisanie
 * tam adresu Neona zabiera lokalny dev z PGlite i każda praca offline pada.
 * Tutaj adres siedzi w osobnej zmiennej `NEON_DATABASE_URL`, a skrypt podaje go
 * jako `DATABASE_URL` tylko trzem krokom, które mają zadziałać na chmurze:
 *
 *   1. db:migrate      → tabele
 *   2. import:pns      → premiery i best of z zestawienia
 *   3. resolve:mbids   → MBID-y, czyli okładki i składy (kilka minut, MB puszcza
 *                        jedno zapytanie na sekundę)
 *
 * Lokalna baza zostaje nietknięta. Można to puszczać wielokrotnie — import
 * nadpisuje po id, a resolve pomija to, co już dowiązane.
 *
 *   npm run neon:setup                 → wszystkie trzy kroki
 *   npm run neon:setup -- --tylko-migracje  → sam krok 1 (sprawdzenie połączenia)
 */
import "dotenv/config";
import { spawnSync } from "node:child_process";

/** Adres z panelu Neona, czy jeszcze zaślepka? */
export function checkNeonUrl(raw: string | undefined): { ok: true; url: string } | { ok: false; why: string } {
  const url = (raw ?? "").trim().replace(/^["']|["']$/g, "");
  if (!url) {
    return {
      ok: false,
      why: `Brak NEON_DATABASE_URL. Dopisz do pliku .env (jedna linia, cały adres z panelu Neona):

  NEON_DATABASE_URL="postgresql://…skopiowane z Neona…?sslmode=require"

.env nie trafia do gita (.gitignore), więc hasło zostaje na Twoim dysku.`,
    };
  }
  if (!/^postgres(ql)?:\/\//.test(url)) return { ok: false, why: `NEON_DATABASE_URL nie wygląda na adres bazy — powinien zaczynać się od „postgresql://". Jest: „${url.slice(0, 30)}…"` };
  // Zaślepki: „…nowy…", <host>, TWOJ-ADRES. Lepiej złapać je tutaj niż getaddrinfo EINVAL.
  if (/[…<>]|nowy|twoj|xxx|tutaj/i.test(url)) return { ok: false, why: `W NEON_DATABASE_URL siedzi jeszcze zaślepka, nie prawdziwy adres. Skopiuj cały ciąg z panelu Neona (Connection string), od „postgresql://” do końca.` };
  if (!/@/.test(url) || !/\//.test(url.split("@")[1] ?? "")) return { ok: false, why: "Adres wygląda na ucięty — brakuje w nim hosta albo nazwy bazy. Skopiuj go jeszcze raz w całości." };
  return { ok: true, url };
}

const STEPS: { label: string; args: string[] }[] = [
  { label: "1/3 tabele (db:migrate)", args: ["run", "db:migrate"] },
  { label: "2/3 premiery i best of (import:pns)", args: ["run", "import:pns", "--", "data/purenewshit.html"] },
  { label: "3/3 okładki i składy (resolve:mbids)", args: ["run", "resolve:mbids"] },
];

function main() {
  const checked = checkNeonUrl(process.env.NEON_DATABASE_URL);
  if (!checked.ok) {
    console.error(`\n${checked.why}\n`);
    process.exit(1);
  }
  // Host bez hasła — żeby było widać, dokąd to leci, i żeby nic wrażliwego nie
  // wylądowało w logu ani na zrzucie ekranu.
  const host = checked.url.split("@")[1]?.split("/")[0] ?? "?";
  console.log(`Baza w chmurze: ${host}\n`);

  const steps = process.argv.includes("--tylko-migracje") ? STEPS.slice(0, 1) : STEPS;
  for (const step of steps) {
    console.log(`— ${step.label}`);
    const r = spawnSync("npm", step.args, {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: checked.url },
    });
    if (r.status !== 0) {
      console.error(`\nKrok „${step.label}" nie przeszedł — dalsze kroki pominięte (bez tabel reszta i tak by padła).`);
      process.exit(r.status ?? 1);
    }
  }
  console.log("\nGotowe. Ten sam adres wpisz na Vercelu jako DATABASE_URL i portal ruszy z tymi danymi.");
}

if (process.argv[1]?.endsWith("neon-setup.ts")) main();
