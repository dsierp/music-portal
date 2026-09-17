/**
 * Teledyski — co zespół nagrał z obrazem i gdzie to obejrzeć.
 *
 * DLACZEGO TAK, A NIE PRZEZ YOUTUBE API: klucz do YouTube Data API ma dzienny
 * limit, który jeden aktywny dzień portalu potrafi wyczerpać, a bez klucza
 * tamto API nie odpowiada wcale. MusicBrainz natomiast WIE, które nagrania są
 * teledyskami (nagranie ma znacznik `video`), i przy części z nich trzyma
 * odnośnik prosto do klipu. To wystarcza na sensowną listę: tytuł zawsze,
 * odnośnik prosto w klip gdy jest, a gdy go nie ma — wyszukanie w YouTube
 * z nazwą zespołu i tytułem, czyli to, co człowiek i tak by wpisał.
 *
 * Jedno zapytanie na stronę. Nie dociągamy odnośników nagranie po nagraniu:
 * MusicBrainz przyjmuje jedno zapytanie na sekundę, więc dwanaście klipów
 * kosztowałoby dwanaście sekund czekania — za drogo jak na dodatek.
 */
import { cached, TTL } from "./cache";

export interface Teledysk {
  /** MBID nagrania — po nim da się wejść głębiej w MusicBrainz. */
  mbid: string;
  title: string;
  /** Rok pierwszego wydania, gdy znany — porządkuje listę w głowie. */
  rok: string | null;
  /** Odnośnik prosto w klip, gdy MusicBrainz go zna. */
  url: string | null;
}

const MB_BASE = "https://musicbrainz.org/ws/2";

function mbHeaders(): HeadersInit {
  return {
    "User-Agent": (process.env.MUSICBRAINZ_USER_AGENT || "PureNewShit/0.1 ( https://music-travel.app )").trim(),
    Accept: "application/json",
  };
}

interface MbVideoRec {
  id: string;
  title: string;
  "first-release-date"?: string;
  video?: boolean;
  relations?: { url?: { resource: string } }[];
}

const KLIP = /(?:youtube\.com|youtu\.be)/i;

/** Wyszukanie w YouTube — ostatnia deska ratunku i zawsze działa. */
export function szukajwYt(artysta: string, tytul?: string): string {
  const q = [artysta, tytul, "official video"].filter(Boolean).join(" ");
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

async function szukajNagran(query: string, klucz: string, limit = 25): Promise<Teledysk[]> {
  const dane = await cached<{ recordings?: MbVideoRec[] }>(klucz, TTL.search, async () => {
    const url = new URL(`${MB_BASE}/recording`);
    url.searchParams.set("query", query);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("fmt", "json");
    const res = await fetch(url, { headers: mbHeaders(), cache: "no-store" });
    if (!res.ok) throw new Error(`MusicBrainz recording ${res.status}`);
    return (await res.json()) as { recordings?: MbVideoRec[] };
  }).catch(() => ({ recordings: [] as MbVideoRec[] }));

  // Jeden teledysk na tytuł: to samo nagranie wisi przy kilku wydaniach
  // (singiel, reedycja, składanka) i bez tego lista byłaby tym samym klipem
  // powtórzonym pięć razy.
  const wg = new Map<string, Teledysk>();
  for (const r of dane.recordings ?? []) {
    if (r.video === false) continue;
    const klucz = r.title.trim().toLowerCase();
    if (!klucz || wg.has(klucz)) continue;
    wg.set(klucz, {
      mbid: r.id,
      title: r.title.trim(),
      rok: r["first-release-date"]?.slice(0, 4) ?? null,
      url: (r.relations ?? []).map((x) => x.url?.resource).find((u) => u && KLIP.test(u)) ?? null,
    });
  }
  return [...wg.values()];
}

/** Teledyski zespołu — nagrania oznaczone w MusicBrainz jako wideo. */
export async function teledyskiArtysty(mbid: string, ile = 12): Promise<Teledysk[]> {
  const lista = await szukajNagran(`arid:${mbid} AND video:true`, `mb:video:artist:v1:${mbid}`);
  return lista.slice(0, ile);
}

/** Teledyski z jednej płyty — to samo pytanie, zawężone do grupy wydawniczej. */
export async function teledyskiPlyty(rgMbid: string, ile = 8): Promise<Teledysk[]> {
  const lista = await szukajNagran(`rgid:${rgMbid} AND video:true`, `mb:video:rg:v1:${rgMbid}`);
  return lista.slice(0, ile);
}
