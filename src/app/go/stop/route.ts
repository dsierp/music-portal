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
  if (sp.get("serwis") === "spotify") {
    const etykieta = sp.get("etykieta") ?? "";
    const { rozbijEtykiete, spotifyAlbumUrl } = await import("@/lib/spotify");
    const { artist, title } = rozbijEtykiete(etykieta);
    const znaleziony = await spotifyAlbumUrl(artist, title).catch(() => null);
    // Gdy się nie uda — wyszukiwarka. Lepsza niż odnośnik donikąd.
    to = znaleziony ?? `https://open.spotify.com/search/${encodeURIComponent(etykieta.replace(/\s+[–—-]\s+/, " "))}`;
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
  if (listId && mbid && (type === "ALBUM" || type === "ARTIST" || type === "CONCERT")) {
    const user = await currentUser().catch(() => null);
    // Odhaczenie jest miłym dodatkiem, nie warunkiem wyjścia: gdy się nie uda,
    // człowiek i tak ma trafić tam, gdzie kliknął.
    if (user) await markVisited(user.id, listId, type, mbid, "link").catch(() => {});
  }
  return NextResponse.redirect(cel.toString());
}
