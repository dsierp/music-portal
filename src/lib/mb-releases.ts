/**
 * Premiery z MusicBrainz dla stylów, których nie ma w imporcie „Pure New Shit".
 *
 * PNS pokrywa death/black, prog i jazz — i to jest sufit tych danych. Żeby
 * kategorie mogły odpowiadać stylom, które użytkownik sobie wybrał (country,
 * pop, punk, klasyka, elektronika…), premiery dla nich bierzemy wprost
 * z MusicBrainz: wyszukiwarka release-group potrafi filtrować po tagu gatunku
 * i dacie pierwszego wydania.
 *
 * Zapytanie (składnia Lucene MB):
 *   tag:"country" AND firstreleasedate:[2026-09-04 TO 2026-09-11] AND primarytype:album
 *
 * Świadome ograniczenia — lepiej je znać niż się na nie nadziać:
 *  - tagi w MB są społecznościowe: świeża płyta bywa nieotagowana przez pierwsze
 *    dni, więc lista dla wąskiego gatunku potrafi być krótka,
 *  - `firstreleasedate` to data release-group, nie konkretnego wydania,
 *  - MB przepuszcza 1 zapytanie na sekundę, więc pobranie kilkunastu stylów
 *    trwa kilkanaście sekund — dlatego robi to zadanie w tle, nie strona.
 */
import { cached, TTL } from "./cache";
import { weekOf, releaseQuery, type WeekWindow } from "./week";
export { weekOf, releaseQuery };
export type { WeekWindow };
import { mbSearchReleaseGroups, type AlbumSummary } from "./musicbrainz";

export interface StyleReleases {
  style: string;
  albums: AlbumSummary[];
}

/**
 * Premiery danego tygodnia dla jednego stylu. Wynik jest cache'owany na tydzień —
 * zestawienie dla minionego piątku już się nie zmieni.
 */
export async function releasesForStyle(style: string, week: WeekWindow, limit = 25): Promise<AlbumSummary[]> {
  return cached(`mb:week:${week.friday}:${style}:${limit}`, TTL.lookup, async () => {
    try {
      return await mbSearchReleaseGroups(releaseQuery(style, week), limit);
    } catch {
      return []; // jeden gatunek bez wyników nie może wywalić całego zestawienia
    }
  });
}

/** Premiery dla wielu stylów, po kolei (MB: 1 zapytanie/s — równoległość nic tu nie da). */
export async function releasesForStyles(styles: string[], week: WeekWindow, limit = 25): Promise<StyleReleases[]> {
  const out: StyleReleases[] = [];
  for (const style of styles) {
    const albums = await releasesForStyle(style, week, limit);
    if (albums.length) out.push({ style, albums });
  }
  return out;
}
