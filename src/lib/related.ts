/**
 * Powiązane zespoły — „skoro słuchasz tego, to zobacz tamto", ale bez zgadywania.
 *
 * Dwa sygnały, oba twarde, oba z MusicBrainz:
 *  1. LUDZIE — kto z tego składu gra (albo grał) gdzie indziej. To najmocniejsze
 *     powiązanie w muzyce niepopowej: sceny trzymają się na osobach, nie na
 *     „podobieństwie" liczonym z odsłuchów. Każdy wspólny muzyk to konkretny
 *     powód, który da się pokazać: „Nergal — gitara, wokal".
 *  2. STYL — wspólne gatunki/tagi. Sam w sobie słaby (pół sceny ma tag
 *     „death metal"), ale dobrze porządkuje zespoły spięte tą samą osobą.
 *
 * Punktacja: każdy wspólny muzyk to 10 punktów, każdy wspólny gatunek 1.
 * Człowiek przeważa styl celowo — wspólny perkusista mówi o zespole więcej niż
 * wspólny tag.
 *
 * Koszt: jedno zapytanie do MusicBrainz na członka składu (limit 1/s), dlatego
 * pytamy o maksymalnie 8 osób i wynik trafia do cache'u na tydzień.
 */
import { cached, TTL } from "./cache";
import { getArtist, type Artist } from "./musicbrainz";

export interface RelatedBand {
  mbid: string;
  name: string;
  /** muzycy łączący ten zespół z oglądanym (nazwa + role) */
  people: { name: string; roles: string[] }[];
  /** wspólne gatunki */
  genres: string[];
  score: number;
}

const MAX_PEOPLE = 8;
const MAX_RESULTS = 12;

/**
 * Zespoły powiązane z `artist`:
 *  - dla ZESPOŁU: inne kapele jego muzyków,
 *  - dla OSOBY: zespoły kolegów z jej własnych kapel (czyli sąsiedztwo sceny).
 * Zwraca pustą listę, gdy MusicBrainz nie ma składu — nie zgadujemy.
 */
export async function relatedBands(artist: Artist): Promise<RelatedBand[]> {
  return cached(`related:v1:${artist.mbid}`, TTL.wiki, async () => {
    // Kogo pytamy: skład zespołu albo — dla osoby — jej własne zespoły.
    const seeds = artist.isPerson ? artist.memberOf : artist.members;
    if (!seeds.length) return [];

    const mine = new Set(artist.genres.map((g) => g.toLowerCase()));
    const acc = new Map<string, RelatedBand>();

    for (const seed of seeds.slice(0, MAX_PEOPLE)) {
      const person = await getArtist(seed.mbid).catch(() => null);
      if (!person) continue;
      // Dla zespołu: gdzie jeszcze grał ten muzyk. Dla osoby: kto grał w jej zespole
      // (a więc z kim się zetknęła) — w obu razach interesują nas cudze kapele.
      const links = artist.isPerson ? person.members : person.memberOf;
      for (const band of links) {
        if (band.mbid === artist.mbid) continue;
        const prev = acc.get(band.mbid);
        const person_ = { name: artist.isPerson ? band.name : person.name, roles: band.roles.length ? band.roles : seed.roles };
        if (prev) {
          if (!prev.people.some((p) => p.name === person_.name)) prev.people.push(person_);
        } else {
          acc.set(band.mbid, { mbid: band.mbid, name: band.name, people: [person_], genres: [], score: 0 });
        }
      }
    }
    if (!acc.size) return [];

    // Wspólne gatunki dobieramy tylko dla najlepszych kandydatów — każdy kosztuje
    // osobne zapytanie, a przy dziesiątkach zespołów czekanie byłoby absurdalne.
    const ranked = [...acc.values()].sort((a, b) => b.people.length - a.people.length).slice(0, MAX_RESULTS);
    for (const cand of ranked) {
      const info = await getArtist(cand.mbid).catch(() => null);
      cand.genres = (info?.genres ?? []).filter((g) => mine.has(g.toLowerCase())).slice(0, 4);
      cand.score = cand.people.length * 10 + cand.genres.length;
    }
    return ranked.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "pl"));
  });
}
