import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { markVisited, type ListTarget } from "@/lib/user-data";

/**
 * Wyjście z przystanku do Spotify albo Tidala — po drodze odhaczamy pozycję.
 *
 * Po to jest ta trasa: „odsłuchane" ma się brać z tego, co człowiek i tak robi,
 * a nie z pamiętania o ptaszku. Adres docelowy przyjmujemy tylko wtedy, gdy
 * prowadzi do znanego serwisu — inaczej byłaby to otwarta przekierowywarka,
 * którą ktoś podpiąłby pod własną stronę.
 */
const DOZWOLONE = ["open.spotify.com", "tidal.com", "listen.tidal.com", "bandcamp.com"];

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  let to = sp.get("to") ?? "";

  /**
   * Adres płyty w Spotify wyszukujemy DOPIERO tu, przy kliknięciu.
   *
   * Wcześniej strona podróży rozwiązywała wszystkie płyty z góry, równolegle —
   * kilkanaście zapytań w jednej chwili, na które Spotify odpowiadał 429
   * („QUOTA_EXCEEDED") i przez to nie trafiał żaden link. Teraz jedno kliknięcie
   * to jedno zapytanie, a wynik i tak leży potem w buforze.
   */
  const serwis = sp.get("serwis");
  const typPrzystanku = sp.get("type");
  if (serwis === "spotify" || serwis === "tidal") {
    const etykieta = sp.get("etykieta") ?? "";
    const mbidPrzystanku = sp.get("mbid") ?? "";
    const { linkSerwisu, HOST_SPOTIFY, HOST_TIDAL } = await import("@/lib/musicbrainz");
    const utwor = typPrzystanku === "RECORDING";

    /**
     * Najpierw MusicBrainz. Trzyma adresy obu serwisów jako zwykłe relacje URL,
     * oddaje je w jednym zapytaniu i — co najważniejsze — działa TAKŻE dla
     * pojedynczego utworu. Tidal nie ma czego szukać bez klucza dewelopera,
     * więc bez tego kawałek zawsze lądował w wyszukiwarce.
     */
    let znaleziony = mbidPrzystanku
      ? await linkSerwisu(utwor ? "recording" : "release-group", mbidPrzystanku, serwis === "tidal" ? HOST_TIDAL : HOST_SPOTIFY).catch(() => null)
      : null;

    // Spotify ma jeszcze własne szukanie po nazwie — ale tylko dla płyt.
    if (!znaleziony && serwis === "spotify" && !utwor) {
      const { rozbijEtykiete, spotifyAlbumUrl } = await import("@/lib/spotify");
      const { artist, title } = rozbijEtykiete(etykieta);
      znaleziony = await spotifyAlbumUrl(artist, title).catch(() => null);
    }

    const fraza = encodeURIComponent(etykieta.replace(/\s+[–—-]\s+/, " "));
    // Gdy się nie uda — wyszukiwarka. Lepsza niż odnośnik donikąd.
    to = znaleziony ?? (serwis === "tidal" ? `https://tidal.com/search?q=${fraza}` : `https://open.spotify.com/search/${fraza}`);

    /**
     * Zapamiętujemy WYNIK, żeby portal mógł to pokazać z góry: przystanek,
     * przy którym wiemy, że prowadzi tylko do wyszukiwarki, dostaje lupkę
     * zamiast strzałki. Pierwsze kliknięcie jest w ciemno, każde następne
     * — i każdy inny człowiek — widzi już, czego się spodziewać.
     */
    if (mbidPrzystanku) {
      const { kvSet } = await import("@/lib/cache");
      await kvSet(`link:${serwis}:${mbidPrzystanku}`, { url: znaleziony ?? null }).catch(() => {});
    }
  }

  let cel: URL;
  try {
    cel = new URL(to);
  } catch {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }
  const host = cel.hostname.replace(/^www\./, "");
  if (cel.protocol !== "https:" || !DOZWOLONE.some((d) => host === d || host.endsWith(`.${d}`))) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  const listId = sp.get("listId");
  const type = sp.get("type") as ListTarget | null;
  const mbid = sp.get("mbid");
  // RECORDING było tu pominięte, więc utwór nigdy się nie odhaczał.
  if (listId && mbid && (type === "ALBUM" || type === "ARTIST" || type === "CONCERT" || type === "RECORDING")) {
    const user = await currentUser().catch(() => null);
    // Odhaczenie jest miłym dodatkiem, nie warunkiem wyjścia: gdy się nie uda,
    // człowiek i tak ma trafić tam, gdzie kliknął.
    if (user) await markVisited(user.id, listId, type, mbid, "link").catch(() => {});
  }
  return NextResponse.redirect(cel.toString());
}
