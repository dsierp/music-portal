import { NextResponse, type NextRequest } from "next/server";

/**
 * Wyjście do Spotify: adres płyty dobieramy DOPIERO tu, przy kliknięciu.
 *
 * Dotąd każdy odnośnik prowadził na `open.spotify.com/search/…`, więc nigdy nie
 * trafiał w płytę — trzeba było celować drugi raz. Rozwiązywanie adresów z góry
 * (przy rysowaniu strony) też odpada: kwota aplikacji w trybie deweloperskim
 * jest mała i wspólna dla całego portalu, a strona z premierami to kilkadziesiąt
 * płyt naraz. Jedno kliknięcie = jedno zapytanie, a wynik zostaje w buforze.
 *
 * Gdy dopasowania nie ma (albo Spotify akurat milczy) — wyszukiwarka. Lepsza
 * niż odnośnik donikąd.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const artist = (sp.get("artist") ?? "").trim();
  const album = (sp.get("album") ?? "").trim();
  const szukaj = `https://open.spotify.com/search/${encodeURIComponent([artist, album].filter(Boolean).join(" "))}`;
  if (!album) return NextResponse.redirect(szukaj);

  const { spotifyAlbumUrl } = await import("@/lib/spotify");
  const prosto = await spotifyAlbumUrl(artist, album).catch(() => null);
  return NextResponse.redirect(prosto ?? szukaj);
}
