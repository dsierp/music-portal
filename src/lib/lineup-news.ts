/**
 * „Kto zmienił zespół" — zmiany składów w zespołach, które śledzisz.
 *
 * MusicBrainz trzyma przy każdym członkostwie daty od–do, więc zmianę składu
 * da się z tego wyliczyć: dołączenie to świeży `begin`, odejście to świeży `end`.
 * Nie ma tu żadnego zgadywania — albo data jest, albo wpisu nie pokazujemy.
 *
 * Skąd bierzemy zespoły do sprawdzenia:
 *  1. Twoje ulubione (★) — te sprawdzamy zawsze,
 *  2. zespoły z ostatnich premier w kategoriach, które masz zaznaczone —
 *     bo o zmianach w scenie, której słuchasz, też warto wiedzieć.
 *
 * Koszt: jedno zapytanie do MusicBrainz na zespół (limit 1/s), dlatego wynik
 * siedzi w cache'u przez tydzień, a liczbę zespołów ograniczamy. Sekcja na
 * stronie głównej ładuje się osobnym strumieniem i nie blokuje reszty.
 */
import { cached, TTL } from "./cache";
import { getArtist } from "./musicbrainz";

export interface LineupChange {
  artistMbid: string;
  artistName: string;
  personMbid: string;
  personName: string;
  roles: string[];
  kind: "joined" | "left";
  /** data zmiany (YYYY-MM-DD albo YYYY-MM / YYYY — MB bywa niedokładny) */
  date: string;
  /** czy zespół jest wśród ulubionych użytkownika */
  favorite: boolean;
}

/** Ile miesięcy wstecz uznajemy za „nowość". */
const WINDOW_MONTHS = 18;

function monthsAgo(date: string, now = new Date()): number {
  const y = Number(date.slice(0, 4));
  if (!Number.isFinite(y)) return Infinity;
  const m = Number(date.slice(5, 7)) || 12; // sam rok → liczymy jak koniec roku
  return (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m);
}

/**
 * Zmiany składu w podanych zespołach z ostatnich ~18 miesięcy, od najnowszych.
 * `favorites` to zbiór MBID-ów, które mają dostać gwiazdkę.
 */
export async function lineupNews(
  bands: { mbid: string; name: string }[],
  favorites: Set<string>,
  limit = 12,
): Promise<LineupChange[]> {
  const key = bands.map((b) => b.mbid).sort().join(",").slice(0, 400);
  return cached(`lineup-news:v1:${key}`, TTL.lookup, async () => {
    const out: LineupChange[] = [];
    for (const band of bands) {
      const info = await getArtist(band.mbid).catch(() => null);
      if (!info) continue;
      for (const m of info.members) {
        // dołączenie
        if (m.begin && monthsAgo(m.begin) <= WINDOW_MONTHS) {
          out.push({
            artistMbid: band.mbid, artistName: info.name, personMbid: m.mbid, personName: m.name,
            roles: m.roles, kind: "joined", date: m.begin, favorite: favorites.has(band.mbid),
          });
        }
        // odejście
        if (m.end && monthsAgo(m.end) <= WINDOW_MONTHS) {
          out.push({
            artistMbid: band.mbid, artistName: info.name, personMbid: m.mbid, personName: m.name,
            roles: m.roles, kind: "left", date: m.end, favorite: favorites.has(band.mbid),
          });
        }
      }
    }
    // Ulubione na górze, potem po dacie — bo o swoim zespole chce się wiedzieć
    // nawet wtedy, gdy zmiana jest starsza niż w cudzym.
    return out
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.date.localeCompare(a.date))
      .slice(0, limit);
  });
}
