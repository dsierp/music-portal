/**
 * Dowiązanie pozycji z importu do MusicBrainz: npm run resolve:mbids
 *
 * Import „Pure New Shit" ma tylko tekst — artystę i tytuł. MBID (a więc okładka
 * z Cover Art Archive, skład i cała „podróż") pojawia się dopiero, gdy ktoś
 * kliknie w tytuł. Efekt: świeże zestawienie stoi bez okładek, dopóki się go
 * nie przeklika.
 *
 * Ten skrypt robi to hurtem — dla premier i dla best of. Chodzi po pozycjach po
 * kolei, bo MusicBrainz przepuszcza jedno zapytanie na sekundę: kilkadziesiąt
 * pozycji to około minuty. Dopasowania i nieudane próby zapisuje ta sama funkcja
 * co przy kliknięciu (resolve.ts), więc nic się nie rozjeżdża.
 *
 *   npm run resolve:mbids          → wszystko, czego jeszcze nie próbowano
 *   npm run resolve:mbids -- --all → także pozycje, przy których próba się nie udała
 */
import "dotenv/config";

async function main() {
  const { db, schema } = await import("../src/db");
  const { isNull, or, lt, and } = await import("drizzle-orm");
  const { resolveRelease, resolveBestOf } = await import("../src/lib/resolve");

  const all = process.argv.includes("--all");
  // Domyślnie bierzemy to, czego jeszcze nie próbowano; z --all także dawne nieudane próby.
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const staleTry = all ? or(isNull(schema.releases.mbidTriedAt), lt(schema.releases.mbidTriedAt, weekAgo)) : isNull(schema.releases.mbidTriedAt);

  const releases = await db
    .select({ id: schema.releases.id, artist: schema.releases.artist, album: schema.releases.album })
    .from(schema.releases)
    .where(and(isNull(schema.releases.mbid), staleTry));

  const staleBest = all
    ? or(isNull(schema.bestOfEntries.mbidTriedAt), lt(schema.bestOfEntries.mbidTriedAt, weekAgo))
    : isNull(schema.bestOfEntries.mbidTriedAt);
  const best = await db
    .select({ id: schema.bestOfEntries.id, artist: schema.bestOfEntries.artist, album: schema.bestOfEntries.album })
    .from(schema.bestOfEntries)
    .where(and(isNull(schema.bestOfEntries.mbid), staleBest));

  const total = releases.length + best.length;
  if (!total) {
    console.log("Nie ma czego dowiązywać — wszystko już ma MBID albo było próbowane.");
    console.log("(--all ponawia próby sprzed tygodnia i starsze)");
    return;
  }
  console.log(`Do dowiązania: ${releases.length} premier + ${best.length} pozycji best of.`);
  console.log(`MusicBrainz: 1 zapytanie/s, więc potrwa ~${Math.ceil(total * 1.2 / 60)} min.\n`);

  let ok = 0;
  for (const [i, r] of releases.entries()) {
    const mbid = await resolveRelease(r.id).catch(() => null);
    if (mbid) ok++;
    console.log(`  [${i + 1}/${releases.length}] ${r.artist} – ${r.album}: ${mbid ?? "nie znaleziono"}`);
  }
  for (const [i, r] of best.entries()) {
    const mbid = await resolveBestOf(r.id).catch(() => null);
    if (mbid) ok++;
    console.log(`  best [${i + 1}/${best.length}] ${r.artist} – ${r.album}: ${mbid ?? "nie znaleziono"}`);
  }
  console.log(`\nDowiązano ${ok} z ${total}. Reszta zwykle dlatego, że MusicBrainz nie ma jeszcze tej płyty.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
