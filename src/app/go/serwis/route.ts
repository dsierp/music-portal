import { NextResponse, type NextRequest } from "next/server";
import { adresBezpieczny, adresWSerwisie, zapiszWyjscie } from "@/lib/adres-plyty";

/**
 * Wyjście do Spotify albo Tidala ze strony płyty i artysty (nowa karta).
 *
 * DLACZEGO NIE ZWYKŁY LINK: adres w serwisie znamy dopiero po zapytaniu.
 * MusicBrainz trzyma go jako relację URL, ale przy PŁYCIE wisi on zwykle przy
 * konkretnym wydaniu, nie przy grupie wydawniczej — więc odnośnik budowany
 * z góry prawie zawsze kończył się wyszukiwarką, choć płyta w serwisie jest.
 * Pytamy więc dopiero przy kliknięciu: jedno zapytanie zamiast kilkudziesięciu
 * przy każdym wejściu na stronę, a wynik i tak ląduje w buforze.
 *
 * Samo ustalanie adresu siedzi w lib/adres-plyty.ts — ten sam kod obsługuje
 * guzik „słuchaj" (`/api/sluchaj`).
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const serwis = sp.get("serwis") === "tidal" ? "tidal" : "spotify";
  const typ = sp.get("typ") === "artist" ? "artist" : "release-group";
  const mbid = sp.get("mbid") ?? "";
  const etykieta = sp.get("etykieta") ?? "";

  const { url, znalezione } = await adresWSerwisie({ serwis, typ, mbid, etykieta });
  await zapiszWyjscie({ serwis, typ, mbid, etykieta, url, znalezione });

  if (!adresBezpieczny(url)) return NextResponse.redirect(new URL("/", req.nextUrl));
  return NextResponse.redirect(url);
}
