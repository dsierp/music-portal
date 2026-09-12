import { NextResponse, type NextRequest } from "next/server";

/**
 * Wyjście do Spotify albo Tidala ze strony płyty i artysty.
 *
 * DLACZEGO NIE ZWYKŁY LINK: adres w serwisie znamy dopiero po zapytaniu.
 * MusicBrainz trzyma go jako relację URL, ale przy PŁYCIE wisi on zwykle przy
 * konkretnym wydaniu, nie przy grupie wydawniczej — więc odnośnik budowany
 * z góry prawie zawsze kończył się wyszukiwarką, choć płyta w serwisie jest.
 * Pytamy więc dopiero przy kliknięciu: jedno zapytanie zamiast kilkudziesięciu
 * przy każdym wejściu na stronę, a wynik i tak ląduje w buforze.
 *
 * Kolejność: MusicBrainz → szukanie po nazwie w Spotify → wyszukiwarka.
 */
const DOZWOLONE = ["open.spotify.com", "tidal.com", "listen.tidal.com"];

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const serwis = sp.get("serwis") === "tidal" ? "tidal" : "spotify";
  const typ = sp.get("typ") === "artist" ? "artist" : "release-group";
  const mbid = sp.get("mbid") ?? "";
  const etykieta = sp.get("etykieta") ?? "";

  const { linkSerwisu, HOST_SPOTIFY, HOST_TIDAL } = await import("@/lib/musicbrainz");
  let cel = mbid
    ? await linkSerwisu(typ, mbid, serwis === "tidal" ? HOST_TIDAL : HOST_SPOTIFY).catch(() => null)
    : null;

  // Spotify ma jeszcze własne szukanie po nazwie — działa dla płyt.
  if (!cel && serwis === "spotify" && typ === "release-group" && etykieta) {
    const { rozbijEtykiete, spotifyAlbumUrl } = await import("@/lib/spotify");
    const { artist, title } = rozbijEtykiete(etykieta);
    cel = await spotifyAlbumUrl(artist, title).catch(() => null);
  }

  const fraza = encodeURIComponent(etykieta.replace(/\s+[–—-]\s+/, " "));
  const znalezione = !!cel;
  cel = cel ?? (serwis === "tidal" ? `https://tidal.com/search?q=${fraza}` : `https://open.spotify.com/search/${fraza}`);

  // Zapamiętujemy wynik, żeby strona mogła pokazać z góry, czy odnośnik
  // prowadzi prosto w płytę, czy do wyszukiwarki.
  if (mbid) {
    const { kvSet } = await import("@/lib/cache");
    await kvSet(`link:${serwis}:${mbid}`, { url: znalezione ? cel : null }).catch(() => {});
  }

  let adres: URL;
  try {
    adres = new URL(cel);
  } catch {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }
  const host = adres.hostname.replace(/^www\./, "");
  if (adres.protocol !== "https:" || !DOZWOLONE.some((d) => host === d || host.endsWith(`.${d}`))) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }
  return NextResponse.redirect(adres.toString());
}
