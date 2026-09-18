/**
 * Premiery tygodnia dla stylów spoza importu „Pure New Shit": npm run fetch:releases
 *
 * PNS daje death/black, prog i jazz. Ten skrypt dobiera resztę — country, pop,
 * punk, klasykę, elektronikę, hip-hop — wprost z MusicBrainz (patrz mb-releases.ts)
 * i zapisuje jako zwykłą sekcję premier, więc strona nie musi wiedzieć, skąd co
 * pochodzi.
 *
 * Uruchamiany co piątek (zadanie w tle). Można też ręcznie:
 *   npm run fetch:releases              → bieżący tydzień
 *   npm run fetch:releases -- 2026-08-28  → tydzień z tym piątkiem
 *
 * Wywołanie jest idempotentne: sekcja tygodnia ma stałe id (mb:<piątek>), więc
 * powtórzony przebieg nadpisuje zestawienie, a nie dokłada duplikatów.
 */
import "dotenv/config";

async function main() {
  const { zaciagnijPremiery } = await import("../src/lib/premiery-tygodnia");
  const arg = process.argv[2];
  const w = await zaciagnijPremiery(arg ? new Date(arg) : new Date());
  if (!w.ile) {
    console.log(`Brak premier dla tych stylow w tygodniu ${w.piatek} — nic nie zapisuje.`);
    console.log("(tagi w MusicBrainz bywaja dodawane z opoznieniem; sprobuj za kilka dni)");
    return;
  }
  for (const x of w.wgStylu) console.log(`  ${x.styl}: ${x.ile}`);
  console.log(`Zapisano ${w.ile} premier w sekcji ${w.sekcja}.`);
}

main()
  .then(() => process.exit(0))
  .catch(async (e) => {
    const { describeDbError } = await import("../src/lib/db-error");
    console.error(describeDbError(e));
    process.exit(1);
  });
