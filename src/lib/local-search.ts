/**
 * Szukanie po tym, co portal już ma u siebie.
 *
 * Dotąd „Szukaj" pytało wyłącznie MusicBrainz — i gdy MB odmawiał (blokada
 * adresu, przeciążenie), strona pokazywała „brak płyt" nawet dla zespołu, który
 * wisi na stronie głównej w premierach. To nieprawda i wygląda na awarię.
 *
 * Ta funkcja przeszukuje premiery i best of w bazie portalu. Wyniki wskazują na
 * /go/release/<id> i /go/best/<id>, czyli te same przejścia co kliknięcie w
 * tytuł na liście: mają MBID — idą prosto do płyty, nie mają — dowiązują je po
 * drodze.
 */
import { db, schema } from "@/db";
import { ilike, or, sql } from "drizzle-orm";

export interface LocalHit {
  href: string;
  artist: string;
  album: string;
  sub: string;
  mbid: string | null;
}

/** Dopasowanie „zawiera" — bez rozróżniania wielkości liter i polskich ogonków. */
export async function localAlbums(q: string, limit = 12): Promise<LocalHit[]> {
  const term = `%${q.trim().replace(/[%_]/g, (m) => `\\${m}`)}%`;
  if (q.trim().length < 2) return [];

  const [rel, best] = await Promise.all([
    db
      .select({
        id: schema.releases.id,
        artist: schema.releases.artist,
        album: schema.releases.album,
        label: schema.releases.label,
        mbid: schema.releases.mbid,
      })
      .from(schema.releases)
      .where(or(ilike(schema.releases.artist, term), ilike(schema.releases.album, term)))
      .limit(limit),
    db
      .select({
        id: schema.bestOfEntries.id,
        artist: schema.bestOfEntries.artist,
        album: schema.bestOfEntries.album,
        year: schema.bestOfEntries.year,
        genre: schema.bestOfEntries.genre,
        mbid: schema.bestOfEntries.mbid,
      })
      .from(schema.bestOfEntries)
      .where(or(ilike(schema.bestOfEntries.artist, term), ilike(schema.bestOfEntries.album, term)))
      .orderBy(sql`${schema.bestOfEntries.year} desc`)
      .limit(limit),
  ]);

  const hits: LocalHit[] = [
    ...rel.map((r) => ({
      href: `/go/release/${r.id}`,
      artist: r.artist ?? "",
      album: r.album ?? "",
      sub: ["premiery", r.label].filter(Boolean).join(" · "),
      mbid: r.mbid,
    })),
    ...best.map((b) => ({
      href: `/go/best/${b.id}`,
      artist: b.artist,
      album: b.album,
      sub: [`best of ${b.year}`, b.genre].filter(Boolean).join(" · "),
      mbid: b.mbid,
    })),
  ];

  // Ta sama płyta bywa i w premierach, i w best of — pokazujemy raz.
  const seen = new Set<string>();
  return hits
    .filter((h) => {
      const key = `${h.artist.toLowerCase()}|${h.album.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}
