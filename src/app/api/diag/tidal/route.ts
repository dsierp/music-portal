import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { TIDAL_SCOPES, tidalConfigured, tidalConnected, tidalJa, tidalPlaylisty } from "@/lib/tidal";

/**
 * Diagnostyka Tidala — dla administratora, bez ujawniania sekretu.
 *
 * Powstała z góry, nie po awarii: integracja z Tidalem jest nowa i nie wiadomo
 * jeszcze, czy aplikacja została dopuszczona do odczytu danych użytkownika
 * (ich forum pełne jest próśb o zatwierdzenie Client ID). „Nie widzę żadnej
 * playlisty" może znaczyć trzy zupełnie różne rzeczy: brak kluczy, brak zgody
 * konta, albo odmowę Tidala. Ta strona rozstrzyga to w jednym wejściu.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  const user = await currentUser().catch(() => null);
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: "tylko administrator" }, { status: 403 });
  }
  const opis = (v: string) => ({ ustawiona: Boolean(v), dlugosc: v.length, czysty: v === v.trim() });
  const wynik: Record<string, unknown> = {
    TIDAL_CLIENT_ID: opis(process.env.TIDAL_CLIENT_ID ?? ""),
    TIDAL_CLIENT_SECRET: opis(process.env.TIDAL_CLIENT_SECRET ?? ""),
    zakresy: TIDAL_SCOPES,
    kraj: process.env.TIDAL_COUNTRY || "PL (domyślnie)",
    skonfigurowany: tidalConfigured(),
    // Adres, który MUSI być wpisany w dashboardzie Tidala — najczęstsza
    // przyczyna „błąd zaraz po kliknięciu Połącz".
    redirectUri: `${process.env.NEXTAUTH_URL || process.env.AUTH_URL || "https://music-travel.app"}/api/auth/callback/tidal`,
  };

  if (tidalConfigured()) {
    wynik.podlaczone = await tidalConnected(user.id).catch(() => false);
    if (wynik.podlaczone) {
      const ja = await tidalJa(user.id).catch(() => null);
      wynik.konto = ja ?? "brak odpowiedzi z /users/me (zakres user.read albo aplikacja niedopuszczona)";
      const listy = await tidalPlaylisty(user.id).catch(() => []);
      wynik.playlisty = { ile: listy.length, pierwsze: listy.slice(0, 5).map((p) => `${p.nazwa} (${p.ile})`) };
    }
  }

  return NextResponse.json(wynik);
}
