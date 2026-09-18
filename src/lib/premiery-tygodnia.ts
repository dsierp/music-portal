/**
 * Premiery tygodnia z MusicBrainz — jedna funkcja, dwa wywołania.
 *
 * Do tej pory żyło to wyłącznie w skrypcie `npm run fetch:releases`, czyli
 * działo się tylko wtedy, gdy ktoś o tym pamiętał w piątek. Ta sama robota
 * siedzi teraz tutaj, żeby mogło ją odpalić zadanie w tle na Vercelu
 * (`/api/cron/premiery`), a skrypt został tym, czym był: ręczną furtką.
 *
 * Idempotentne: sekcja tygodnia ma stałe id `mb:<piątek>`, więc powtórzony
 * przebieg NADPISUJE zestawienie zamiast dokładać duplikaty. To ważne przy
 * zadaniu w tle — tagi w MusicBrainz dochodzą z opóźnieniem, więc opłaca się
 * puścić to kilka razy w weekend i za każdym razem mieć pełniejszą listę.
 */
import { STYLES_FROM_MB_BY_CATEGORY } from "./genres";

export interface WynikPremier {
  sekcja: string;
  piatek: string;
  ile: number;
  wgStylu: { styl: string; ile: number }[];
}

/** Piątek za tydzień — do zaciągania zapowiedzi. */
export function zaTydzien(od = new Date()): Date {
  const d = new Date(od);
  d.setDate(d.getDate() + 7);
  return d;
}

export async function zaciagnijPremiery(kiedy?: Date): Promise<WynikPremier> {
  const { db, schema } = await import("@/db");
  const { eq } = await import("drizzle-orm");
  const { weekOf, releasesForStyles } = await import("./mb-releases");

  const week = weekOf(kiedy ?? new Date());
  const found: { style: string; albums: Awaited<ReturnType<typeof releasesForStyles>>[number]["albums"] }[] = [];
  for (const c of STYLES_FROM_MB_BY_CATEGORY) {
    const byTag = await releasesForStyles(c.tags, week);
    const seen = new Set<string>();
    const albums = byTag.flatMap((x) => x.albums).filter((a) => (seen.has(a.mbid) ? false : (seen.add(a.mbid), true)));
    if (albums.length) found.push({ style: c.slug, albums });
  }
  const total = found.reduce((n, s) => n + s.albums.length, 0);
  const sectionId = `mb:${week.friday}`;
  const wgStylu = found.map((f) => ({ styl: f.style, ile: f.albums.length }));
  if (!total) return { sekcja: sectionId, piatek: week.friday, ile: 0, wgStylu };

  const [d, m, y] = [week.friday.slice(8), week.friday.slice(5, 7), week.friday.slice(0, 4)];
  await db
    .insert(schema.releaseSections)
    .values({
      id: sectionId,
      kind: "mb",
      title: "Nowe wydania",
      date: `${d}.${m}.${y}`,
      sortDate: new Date(week.friday),
      // Tydzień, który dopiero nadejdzie, to ZAPOWIEDZI, nie premiery — i tak
      // trzeba to nazwać, bo inaczej człowiek klika w płytę, której jeszcze
      // nie ma w żadnym serwisie.
      sub:
        week.friday > new Date().toISOString().slice(0, 10)
          ? `zapowiedzi na piątek ${week.friday.slice(8)}.${week.friday.slice(5, 7)} — z MusicBrainz`
          : "z MusicBrainz — style spoza zestawienia Pure New Shit",
      pickId: null,
    })
    .onConflictDoUpdate({ target: schema.releaseSections.id, set: { importedAt: new Date() } });

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
        mbid: a.mbid,
        mbidTriedAt: new Date(),
      });
    }
  }
  await db.insert(schema.releases).values(rows);
  return { sekcja: sectionId, piatek: week.friday, ile: rows.length, wgStylu };
}
