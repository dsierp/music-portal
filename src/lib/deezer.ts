/**
 * Deezer — szybkie podpowiedzi, zanim odezwie się MusicBrainz.
 *
 * Po co jeszcze jedno źródło: szukanie było najsłabszym miejscem portalu, bo
 * wyszukiwarka pełnotekstowa MusicBrainz to ich najdroższa końcówka — jedno
 * zapytanie na sekundę, chętne 503 i kilkanaście sekund czekania, gdy akurat
 * ma gorszy dzień. Deezer odpowiada w kilkadziesiąt milisekund, bez klucza
 * i bez kolejki.
 *
 * Czego Deezer NIE daje i dlatego nie zastępuje MusicBrainz:
 * — nie ma MBID, a na nich stoi cały portal (podróż po składach zaczyna się od
 *   identyfikatora, nie od nazwy); dlatego trafienie stąd rozwiązujemy dopiero
 *   przy kliknięciu, jednym zapytaniem do MusicBrainz;
 * — to katalog streamingowy, nie baza: zna zespoły i płyty, ale muzyka
 *   sesyjnego bez własnych wydawnictw (perkusista Mgły) tam nie będzie;
 * — nie zna składów, kredytów ani dat — a to jest treść tego portalu.
 *
 * Traktujemy go więc jak spis treści, nie jak źródło wiedzy.
 */
import { cached, TTL } from "./cache";

const API = "https://api.deezer.com";
/** Deezer bywa szybki, ale nie chcemy na niego czekać — od tego jest MusicBrainz. */
const TIMEOUT_MS = 2500;

export interface DzArtysta {
  id: number;
  name: string;
  picture: string | null;
  albums: number;
  fans: number;
}

export interface DzAlbum {
  id: number;
  title: string;
  artist: string;
  cover: string | null;
  year: string | null;
}

async function pobierz<T>(sciezka: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${sciezka}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    // Cisza jest w porządku: to tylko przyspieszacz, a wyniki i tak przyjdą
    // z MusicBrainz.
    return null;
  }
}

interface DzArtystaRaw {
  id: number;
  name: string;
  picture_medium?: string;
  nb_album?: number;
  nb_fan?: number;
}

interface DzAlbumRaw {
  id: number;
  title: string;
  cover_medium?: string;
  release_date?: string;
  artist?: { name?: string };
}

/**
 * Zespoły i muzycy. Odsiewamy pozycje bez ani jednej płyty i bez słuchaczy —
 * Deezer trzyma mnóstwo pustych wpisów-duchów po tej samej nazwie, a one na
 * liście wyglądają jak prawdziwe trafienia.
 */
export async function deezerArtysci(q: string, limit = 6): Promise<DzArtysta[]> {
  if (q.trim().length < 2) return [];
  const dane = await cached(`dz:artist:v1:${q.toLowerCase()}:${limit}`, TTL.search, () =>
    pobierz<{ data?: DzArtystaRaw[] }>(`/search/artist?q=${encodeURIComponent(q)}&limit=${limit * 2}`),
  ).catch(() => null);
  return (dane?.data ?? [])
    .filter((a) => (a.nb_album ?? 0) > 0 || (a.nb_fan ?? 0) > 100)
    .slice(0, limit)
    .map((a) => ({
      id: a.id,
      name: a.name,
      picture: a.picture_medium ?? null,
      albums: a.nb_album ?? 0,
      fans: a.nb_fan ?? 0,
    }));
}

export async function deezerAlbumy(q: string, limit = 6): Promise<DzAlbum[]> {
  if (q.trim().length < 2) return [];
  const dane = await cached(`dz:album:v1:${q.toLowerCase()}:${limit}`, TTL.search, () =>
    pobierz<{ data?: DzAlbumRaw[] }>(`/search/album?q=${encodeURIComponent(q)}&limit=${limit}`),
  ).catch(() => null);
  return (dane?.data ?? []).map((a) => ({
    id: a.id,
    title: a.title,
    artist: a.artist?.name ?? "",
    cover: a.cover_medium ?? null,
    year: a.release_date?.slice(0, 4) || null,
  }));
}
