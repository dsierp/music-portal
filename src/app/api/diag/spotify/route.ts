import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { rozbijEtykiete } from "@/lib/spotify";

/**
 * Diagnostyka połączenia ze Spotify — dla administratora, bez ujawniania kluczy.
 *
 * Powstała, bo produkcja odpowiadała „problem z konfiguracją serwera" i nie było
 * jak dojść, czy winne są klucze, czy kod: Vercel nie oddaje sekretów z powrotem,
 * a log nic nie pokazywał. Ta trasa robi jedno prawdziwe zapytanie o token
 * aplikacji i mówi, co odpowiedział Spotify.
 *
 * Nie zwraca wartości kluczy — tylko długości i to, czy mają na końcu spację
 * albo cudzysłów, bo dokładnie to najczęściej psuje wklejanie do panelu.
 */
export async function GET(req: Request) {
  const user = await currentUser().catch(() => null);
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: "tylko administrator" }, { status: 403 });
  }

  let wyczyszczono: number | null = null;
  const id = process.env.SPOTIFY_CLIENT_ID ?? "";
  const secret = process.env.SPOTIFY_CLIENT_SECRET ?? "";
  const opis = (v: string) => ({
    dlugosc: v.length,
    czysty: v === v.trim(),
    wCudzyslowie: /^["'].*["']$/.test(v),
  });

  const wynik: Record<string, unknown> = {
    clientId: opis(id),
    clientSecret: opis(secret),
    authUrl: process.env.AUTH_URL ?? null,
  };

  if (id && secret) {
    try {
      const res = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${id.trim()}:${secret.trim()}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ grant_type: "client_credentials" }),
        cache: "no-store",
      });
      const tresc = await res.text();
      wynik.token = {
        status: res.status,
        ok: res.ok,
        // Odpowiedź błędu Spotify jest krótka i nie zawiera naszych kluczy.
        odpowiedz: res.ok ? "token otrzymany" : tresc.slice(0, 200),
      };
    } catch (e) {
      wynik.token = { blad: e instanceof Error ? e.message : String(e) };
    }
  }
  /**
   * Próbne szukanie płyty — po to, żeby zobaczyć, co Spotify NAPRAWDĘ odpowiada.
   * Wywołanie: /api/diag/spotify?album=Achilles&artist=Audrey%20Horne
   * albo krócej: ?etykieta=Audrey%20Horne%20%E2%80%93%20Achilles
   */
  const sp = new URL(req.url).searchParams;

  // ?wyczysc=1 — wymiata zapamiętane odpowiedzi Spotify. Potrzebne, bo bufor
  // potrafił zapisać PUSTY wynik (gdy serwis chwilowo odmówił) i trzymać go
  // tydzień, przez co dopasowanie płyt nie działało mimo poprawnego kodu.
  if (sp.get("wyczysc") === "1") {
    const { cacheForgetPrefix } = await import("@/lib/cache");
    wyczyszczono = await cacheForgetPrefix("spotify:");
    wynik.wyczyszczonoWpisow = wyczyszczono;
  }
  const etykieta = sp.get("etykieta");
  const artist = sp.get("artist") ?? (etykieta ? rozbijEtykiete(etykieta).artist : "");
  const album = sp.get("album") ?? (etykieta ? rozbijEtykiete(etykieta).title : "");

  // Druga połowa: konto TEGO użytkownika. Klucze aplikacji mogą być idealne,
  // a wysyłka i tak nie zadziała, bo konto nie jest połączone albo Spotify
  // odmawia mu obsługi (tryb deweloperski dopuszcza tylko dopisane osoby).
  const { spotifyBlocked, spotifyConnected, nowPlaying } = await import("@/lib/spotify");
  wynik.konto = {
    polaczone: await spotifyConnected(user.id).catch(() => false),
    odmowaZapamietana: await spotifyBlocked(user.id).catch(() => false),
    teraz: (await nowPlaying(user.id).catch(() => null)) ? "coś leci" : "nic nie leci albo brak dostępu",
  };

  if (album || artist) {
    const { szukajAlbumuDiag, spotifyFindAlbum } = await import("@/lib/spotify");
    wynik.szukanie = await szukajAlbumuDiag(user.id, artist, album).catch((e) => ({
      blad: e instanceof Error ? e.message : String(e),
    }));
    // Ścieżka, którą naprawdę chodzą teraz linki i wysyłka playlisty: katalog
    // pytany tokenem APLIKACJI, bez udziału konta użytkownika.
    wynik.katalogAplikacji = await spotifyFindAlbum(artist, album).catch((e) => ({
      blad: e instanceof Error ? e.message : String(e),
    }));
  }

  return NextResponse.json(wynik);
}
