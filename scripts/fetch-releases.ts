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
import { STYLES_FROM_MB_BY_CATEGORY } from "../src/lib/genres";

async function main() {
  const { db, schema } = await import("../src/db");
  const { eq } = await import("drizzle-orm");
  const { weekOf, releasesForStyles } = await import("../src/lib/mb-releases");

  const arg = process.argv[2];
  const week = weekOf(arg ? new Date(arg) : new Date());
  console.log(`Tydzień ${week.from} … ${week.to} (piątek ${week.friday})`);
  const cats = STYLES_FROM_MB_BY_CATEGORY;
  console.log(`Kategorie spoza importu: ${cats.map((c) => c.label).join(", ")}`);

  // Pytamy MB tagami kategorii, a zapisujemy pod jej slugiem — dzięki temu
  // premiery trafiają do tej samej kategorii, którą człowiek wybrał w profilu.
  const found: { style: string; albums: Awaited<ReturnType<typeof releasesForStyles>>[number]["albums"] }[] = [];
  for (const c of cats) {
    const byTag = await releasesForStyles(c.tags, week);
    const seen = new Set<string>();
    const albums = byTag.flatMap((x) => x.albums).filter((a) => (seen.has(a.mbid) ? false : (seen.add(a.mbid), true)));
    if (albums.length) found.push({ style: c.slug, albums });
  }
  const total = found.reduce((n, s) => n + s.albums.length, 0);
  if (!total) {
    console.log("Brak premier dla tych stylów w tym tygodniu — nic nie zapisuję.");
    console.log("(tagi w MusicBrainz bywają dodawane z opóźnieniem; spróbuj za kilka dni)");
    return;
  }

  const sectionId = `mb:${week.friday}`;
  const [d, m, y] = [week.friday.slice(8), week.friday.slice(5, 7), week.friday.slice(0, 4)];
  await db
    .insert(schema.releaseSections)
    .values({
      id: sectionId,
      kind: "mb",
      title: "Nowe wydania",
      date: `${d}.${m}.${y}`,
      sortDate: new Date(week.friday),
      sub: "z MusicBrainz — style spoza zestawienia Pure New Shit",
      pickId: null,
    })
    .onConflictDoUpdate({ target: schema.releaseSections.id, set: { importedAt: new Date() } });

  // czyścimy poprzedni przebieg tego tygodnia, żeby nie mnożyć wpisów
  await db.delete(schema.releases).where(eq(schema.releases.sectionId, sectionId));

  let position = 0;
  const rows = [];
  for (const { style, albums } of found) {
    for (const a of albums) {
      rows.push({
        id: `${sectionId}:${style}:${a.mbid}`,
        sectionId,
        position: position++,
        genre: style,
        star: 0,
        artist: a.artistText,
        album: a.title,
        label: null,
        description: `Premiera ${a.firstReleaseDate ?? week.friday} — z MusicBrainz.`,
        reviews: null,
        flag: a.secondaryTypes.includes("Compilation") ? "comp" : a.secondaryTypes.includes("Live") ? "live" : null,
        dayLabel: a.firstReleaseDate,
        mbid: a.mbid, // od razu połączone z MusicBrainz → okładka i „podróż" działają bez klikania
        mbidTriedAt: new Date(),
      });
    }
  }
  await db.insert(schema.releases).values(rows);
  for (const { style, albums } of found) console.log(`  ${style}: ${albums.length}`);
  console.log(`Zapisano ${rows.length} premier w sekcji ${sectionId}.`);
}

main()
  .then(() => process.exit(0))
  .catch(async (e) => {
    const { describeDbError } = await import("../src/lib/db-error");
    console.error(describeDbError(e));
    process.exit(1);
  });
