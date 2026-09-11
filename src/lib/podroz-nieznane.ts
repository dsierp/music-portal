/**
 * „Podróż w nieznane" — od zdania do listy płyt, które naprawdę istnieją.
 *
 * Łańcuch jest krótki i celowo jednokierunkowy:
 *
 *   opis → MODEL proponuje → MUSICBRAINZ potwierdza → podróż
 *
 * Wszystko, czego MusicBrainz nie potwierdzi, wypada po cichu. Nigdy nie
 * pokazujemy pozycji, której portal nie umie otworzyć — bo kliknięcie w taką
 * płytę kończyłoby się tam, gdzie już raz było: w wyszukiwarce.
 *
 * Dlatego prosimy model o WIĘCEJ pozycji, niż chcemy pokazać: przy niszowych
 * rzeczach część i tak nie ma wpisu w MusicBrainz.
 */
import { findAlbumMbid, MbError, type AlbumSummary } from "./musicbrainz";
import { zaproponujPlyty, type Propozycja } from "./ai";

export interface Przystanek {
  album: AlbumSummary;
  /** zdanie modelu: dlaczego akurat to */
  why: string;
}

export interface WynikPodrozy {
  przystanki: Przystanek[];
  /** ile propozycji odpadło, bo MusicBrainz ich nie zna */
  odpadlo: number;
  /** czy MusicBrainz miał zadyszkę — wtedy „odpadło" nie znaczy „nie istnieje" */
  awaria: boolean;
}

/**
 * Sprawdza propozycje w MusicBrainz i zwraca tylko te z MBID.
 *
 * Chodzimy po kolei, bo MusicBrainz przepuszcza jedno zapytanie na sekundę —
 * piętnaście pozycji to około pół minuty. `limit` przerywa, gdy uzbieramy
 * tyle, ile chcieliśmy pokazać: nie ma po co pytać o resztę.
 */
export async function potwierdz(propozycje: Propozycja[], limit = 10): Promise<WynikPodrozy> {
  const przystanki: Przystanek[] = [];
  const widziane = new Set<string>();
  let odpadlo = 0;
  let awaria = false;

  for (const p of propozycje) {
    if (przystanki.length >= limit) break;
    let znaleziony: AlbumSummary | null = null;
    try {
      znaleziony = await findAlbumMbid(p.artist, p.album);
    } catch (e) {
      // Zadyszka MusicBrainz to nie jest dowód, że płyty nie ma. Zapamiętujemy
      // to, żeby móc powiedzieć prawdę o tym, czego brakuje.
      if (e instanceof MbError) awaria = true;
      else awaria = true;
    }
    if (!znaleziony) {
      odpadlo++;
      continue;
    }
    // Model bywa uparty i podaje tę samą płytę dwa razy pod innym tytułem.
    if (widziane.has(znaleziony.mbid)) continue;
    widziane.add(znaleziony.mbid);
    przystanki.push({ album: znaleziony, why: p.why });
  }
  return { przystanki, odpadlo, awaria };
}

/** Cała droga naraz: opis → gotowe przystanki. */
export async function ulozPodroz(
  opis: string,
  kontekst: { style?: string[]; zna?: string[] },
  ile = 10,
): Promise<WynikPodrozy> {
  // Z zapasem: przy niszowych rzeczach nawet co trzecia propozycja może nie
  // mieć wpisu w MusicBrainz.
  const propozycje = await zaproponujPlyty(opis, { ...kontekst, ile: Math.ceil(ile * 1.6) });
  return potwierdz(propozycje, ile);
}
