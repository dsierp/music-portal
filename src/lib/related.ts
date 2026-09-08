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
  /**
   * Wizytówka zespołu: własne gatunki, skąd jest, kiedy grał, czym się różni od
   * imiennika. Bez tego karta mówiła tylko „gra tu ten sam basista", a to za
   * mało, żeby zdecydować, w co kliknąć — a po to ta sekcja jest.
   */
  ownGenres: string[];
  country: string | null;
  area: string | null;
  begin: string | null;
  end: string | null;
  ended: boolean;
  disambiguation: string | null;
  score: number;
}

const MAX_PEOPLE = 8;
const MAX_RESULTS = 12;
/** Dla osoby: ile jej zespołów przeglądamy i ilu kolegów z nich bierzemy. */
const MAX_OWN_BANDS = 4;
const MAX_COLLEAGUES = 6;

/**
 * Zespoły powiązane z `artist`:
 *  - dla ZESPOŁU: inne kapele jego muzyków,
 *  - dla OSOBY: zespoły kolegów z jej własnych kapel (czyli sąsiedztwo sceny).
 * Zwraca pustą listę, gdy MusicBrainz nie ma składu — nie zgadujemy.
 */
export async function relatedBands(artist: Artist): Promise<RelatedBand[]> {
  return cached(`related:v2:${artist.mbid}`, TTL.wiki, async () => {
    const mine = new Set(artist.genres.map((g) => g.toLowerCase()));
    const acc = new Map<string, RelatedBand>();
    /** Zawsze zbieramy ZESPOŁY. Osoba jako „powiązany zespół" to była pomyłka. */
    const addBand = (mbid: string, name: string, via: { name: string; roles: string[] }) => {
      if (mbid === artist.mbid || name === artist.name) return;
      const prev = acc.get(mbid);
      if (prev) {
        if (!prev.people.some((p) => p.name === via.name)) prev.people.push(via);
      } else {
        acc.set(mbid, {
          mbid, name, people: [via], genres: [], score: 0,
          ownGenres: [], country: null, area: null, begin: null, end: null, ended: false, disambiguation: null,
        });
      }
    };

    if (artist.isPerson) {
      // Dla człowieka droga jest o krok dłuższa: jego zespoły → koledzy z tych
      // zespołów → INNE kapele tych kolegów. Wcześniej zatrzymywaliśmy się na
      // kolegach i portal wypisywał ludzi pod nagłówkiem „Powiązane zespoły".
      const ownBands = new Set(artist.memberOf.map((b) => b.mbid));
      const colleagues = new Map<string, { name: string; roles: string[] }>();
      for (const band of artist.memberOf.slice(0, MAX_OWN_BANDS)) {
        const info = await getArtist(band.mbid).catch(() => null);
        for (const m of info?.members ?? []) {
          if (m.mbid === artist.mbid || colleagues.has(m.mbid)) continue;
          colleagues.set(m.mbid, { name: m.name, roles: m.roles });
        }
      }
      for (const [mbid, who] of [...colleagues].slice(0, MAX_COLLEAGUES)) {
        const person = await getArtist(mbid).catch(() => null);
        for (const b of person?.memberOf ?? []) {
          if (ownBands.has(b.mbid)) continue;
          addBand(b.mbid, b.name, who);
        }
      }
    } else {
      // Dla zespołu wystarczy jeden krok: gdzie jeszcze grali jego muzycy.
      for (const seed of artist.members.slice(0, MAX_PEOPLE)) {
        const person = await getArtist(seed.mbid).catch(() => null);
        if (!person) continue;
        for (const b of person.memberOf) {
          addBand(b.mbid, b.name, { name: person.name, roles: b.roles.length ? b.roles : seed.roles });
        }
      }
    }
    if (!acc.size) return [];

    // Wspólne gatunki dobieramy tylko dla najlepszych kandydatów — każdy kosztuje
    // osobne zapytanie, a przy dziesiątkach zespołów czekanie byłoby absurdalne.
    const ranked = [...acc.values()].sort((a, b) => b.people.length - a.people.length).slice(0, MAX_RESULTS);
    const out: RelatedBand[] = [];
    for (const cand of ranked) {
      const info = await getArtist(cand.mbid).catch(() => null);
      // Ostatnie sito: gdyby po drodze wpadł człowiek, tutaj wypada.
      if (info?.isPerson) continue;
      cand.genres = (info?.genres ?? []).filter((g) => mine.has(g.toLowerCase())).slice(0, 4);
      // Te same dane, które i tak przyszły w lookupie — grzech ich nie pokazać.
      cand.ownGenres = (info?.genres?.length ? info.genres : (info?.tags ?? [])).slice(0, 4);
      cand.country = info?.country ?? null;
      cand.area = info?.area ?? null;
      cand.begin = info?.begin ?? null;
      cand.end = info?.end ?? null;
      cand.ended = !!info?.ended;
      cand.disambiguation = info?.disambiguation ?? null;
      cand.score = cand.people.length * 10 + cand.genres.length;
      out.push(cand);
    }
    return out.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "pl"));
  });
}
