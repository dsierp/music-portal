import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";

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
export async function GET() {
  const user = await currentUser().catch(() => null);
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: "tylko administrator" }, { status: 403 });
  }

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
  return NextResponse.json(wynik);
}
