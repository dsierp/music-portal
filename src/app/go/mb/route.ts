import { NextResponse, type NextRequest } from "next/server";
import { findAlbumMbid, searchArtists } from "@/lib/musicbrainz";

/**
 * Trafienie z szybkiego źródła → strona w portalu.
 *
 * Podpowiedzi z Deezera przychodzą w kilkadziesiąt milisekund, ale nie niosą
 * MBID — a bez niego nie ma po czym podróżować. Rozwiązujemy je więc DOPIERO
 * przy kliknięciu: jedno zapytanie do MusicBrainz, po którym człowiek jest już
 * na właściwej stronie. To lepszy podział czekania niż dotąd: najpierw widzisz,
 * co jest, a czekasz dopiero po wybraniu.
 *
 * Gdy nie trafimy, lądujemy na zwykłych wynikach szukania z tą nazwą — czyli
 * najgorszy przypadek jest równy temu, co portal robił wcześniej.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const nazwa = (sp.get("nazwa") ?? "").trim();
  const artysta = (sp.get("artysta") ?? "").trim();
  const typ = sp.get("typ") === "album" ? "album" : "artist";
  const naSzukanie = new URL(`/szukaj?q=${encodeURIComponent(artysta || nazwa)}&miss=1`, req.nextUrl);
  if (!nazwa) return NextResponse.redirect(naSzukanie);

  if (typ === "album") {
    const trafiony = await findAlbumMbid(artysta, nazwa).catch(() => null);
    return NextResponse.redirect(
      trafiony ? new URL(`/album/${trafiony.mbid}`, req.nextUrl) : naSzukanie,
    );
  }

  const znalezieni = await searchArtists(nazwa, 1).catch(() => []);
  return NextResponse.redirect(
    znalezieni[0] ? new URL(`/artist/${znalezieni[0].mbid}`, req.nextUrl) : naSzukanie,
  );
}
