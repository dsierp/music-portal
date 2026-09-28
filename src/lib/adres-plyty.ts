/**
 * Adres płyty (albo artysty) w Spotify i Tidalu — ustalany przy kliknięciu.
 *
 * Wspólne dla zwykłego wyjścia (`/go/serwis`, nowa karta) i dla guzika
 * „słuchaj" (`/api/sluchaj`: graj w Spotify, otwórz w aplikacji Tidal).
 * Jedna droga ustalania adresu = jedna droga poprawek.
 *
 * Kolejność: MusicBrainz → szukanie po nazwie w katalogu serwisu →
 * wyszukiwarka serwisu (ostatnia deska ratunku, `znalezione: false`).
 */
export type Serwis = "spotify" | "tidal";
export type TypCelu = "release-group" | "artist";

export async function adresWSerwisie(o: {
  serwis: Serwis;
  typ: TypCelu;
  mbid: string;
  etykieta: string;
}): Promise<{ url: string; znalezione: boolean }> {
  const { linkSerwisu, HOST_SPOTIFY, HOST_TIDAL } = await import("@/lib/musicbrainz");
  let cel = o.mbid
    ? await linkSerwisu(o.typ, o.mbid, o.serwis === "tidal" ? HOST_TIDAL : HOST_SPOTIFY).catch(() => null)
    : null;

  if (!cel && o.typ === "release-group" && o.etykieta) {
    const { rozbijEtykiete } = await import("@/lib/spotify");
    const { artist, title } = rozbijEtykiete(o.etykieta);
    if (o.serwis === "spotify") {
      const { spotifyAlbumUrl } = await import("@/lib/spotify");
      cel = await spotifyAlbumUrl(artist, title).catch(() => null);
    } else {
      const { tidalAlbumUrl } = await import("@/lib/tidal");
      cel = await tidalAlbumUrl(artist, title).catch(() => null);
    }
  }

  const fraza = encodeURIComponent(o.etykieta.replace(/\s+[–—-]\s+/, " "));
  if (cel) return { url: cel, znalezione: true };
  return {
    url: o.serwis === "tidal" ? `https://tidal.com/search?q=${fraza}` : `https://open.spotify.com/search/${fraza}`,
    znalezione: false,
  };
}

/**
 * Ślad po wyjściu: czy odnośnik prowadził prosto w płytę (strona pokazuje to
 * z góry znakiem ▸/⌕) i wpis w dzienniku odsłuchów — przy Tidalu to jedyny
 * ślad słuchania, jaki mamy, bo Tidal nie oddaje historii.
 */
export async function zapiszWyjscie(o: {
  serwis: Serwis;
  typ: TypCelu;
  mbid: string;
  etykieta: string;
  url: string;
  znalezione: boolean;
}): Promise<void> {
  if (o.mbid) {
    const { kvSet } = await import("@/lib/cache");
    await kvSet(`link:${o.serwis}:${o.mbid}`, { url: o.znalezione ? o.url : null }).catch(() => {});
  }
  const { currentUser } = await import("@/lib/auth");
  const user = await currentUser().catch(() => null);
  if (!user || !o.etykieta) return;
  const { rozbijEtykiete } = await import("@/lib/names");
  const { artist, title } = rozbijEtykiete(o.etykieta);
  const { zapiszOdsluch } = await import("@/lib/grane");
  await zapiszOdsluch(user.id, {
    artist: artist || o.etykieta,
    title: title || o.etykieta,
    album: title || null,
    mbid: o.typ === "release-group" ? o.mbid || null : null,
    source: "klik",
  }).catch(() => {});
}

/** Identyfikator płyty z adresu serwisu — do „graj" i do otwierania w aplikacji. */
export function idPlyty(serwis: Serwis, url: string): string | null {
  const m = serwis === "spotify" ? url.match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?album\/([A-Za-z0-9]+)/) : url.match(/tidal\.com\/(?:browse\/)?album\/(\d+)/);
  return m?.[1] ?? null;
}

const DOZWOLONE = ["open.spotify.com", "tidal.com", "listen.tidal.com"];
/** Czy adres wolno komuś podać — tylko https i tylko hosty serwisów. */
export function adresBezpieczny(url: string): boolean {
  try {
    const a = new URL(url);
    const host = a.hostname.replace(/^www\./, "");
    return a.protocol === "https:" && DOZWOLONE.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}
