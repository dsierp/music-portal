import { NextResponse, type NextRequest } from "next/server";
import { adresBezpieczny, adresWSerwisie, idPlyty, zapiszWyjscie } from "@/lib/adres-plyty";

/**
 * Guzik „słuchaj" — dwie rzeczy, których zwykły link nie umie.
 *
 * GET: co ten człowiek ma podłączone (Spotify, Tidal) i napisy w jego języku.
 *   Guzik to komponent kliencki, który stoi na wielu kartach naraz — pyta raz
 *   na stronę i na tej podstawie wybiera, co jest akcją domyślną.
 *
 * POST: akcja na konkretnej płycie.
 *   - `graj` (Spotify): puszcza płytę na urządzeniu, na którym człowiek ma
 *     otwarte Spotify. Gdy się nie da, oddaje powód i zwykły adres płyty.
 *   - `aplikacja` (Tidal): adres `tidal://album/…`, który otwiera płytę
 *     w aplikacji Tidala. Tidal nie daje zewnętrznym aplikacjom sterowania
 *     odtwarzaniem (stan na 2026), więc to jest najbliżej „graj", jak się da.
 *
 * Zawsze oddajemy też `url` — zwykły adres w serwisie — żeby guzik miał dokąd
 * pójść, gdy sprytniejsza droga zawiedzie.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const { i18n } = await import("@/lib/t");
  const { t } = await i18n();
  const teksty = {
    playSpotify: t.nav.playSpotify,
    openTidalApp: t.nav.openTidalApp,
    spotifyWeb: t.nav.spotifyWeb,
    tidalWeb: t.nav.tidalWeb,
    playMore: t.nav.playMore,
    playingOn: t.nav.playingOn,
    playNoDevice: t.nav.playNoDevice,
    playNeedsConsent: t.nav.playNeedsConsent,
    playPremium: t.nav.playPremium,
    playFailed: t.nav.playFailed,
    tidalNotFound: t.nav.tidalNotFound,
  };
  const { currentUser } = await import("@/lib/auth");
  const user = await currentUser().catch(() => null);
  if (!user) return NextResponse.json({ zalogowany: false, spotify: false, tidal: false, teksty });
  const [{ spotifyConnected }, { tidalConnected }] = await Promise.all([import("@/lib/spotify"), import("@/lib/tidal")]);
  const [spotify, tidal] = await Promise.all([
    spotifyConnected(user.id).catch(() => false),
    tidalConnected(user.id).catch(() => false),
  ]);
  return NextResponse.json({ zalogowany: true, spotify, tidal, teksty });
}

export async function POST(req: NextRequest) {
  const b = (await req.json().catch(() => ({}))) as {
    serwis?: string;
    typ?: string;
    mbid?: string;
    etykieta?: string;
    tryb?: string;
  };
  const serwis = b.serwis === "tidal" ? "tidal" : "spotify";
  const typ = b.typ === "artist" ? "artist" : "release-group";
  const mbid = String(b.mbid ?? "").slice(0, 64);
  const etykieta = String(b.etykieta ?? "").slice(0, 400);

  const { url, znalezione } = await adresWSerwisie({ serwis, typ, mbid, etykieta });
  await zapiszWyjscie({ serwis, typ, mbid, etykieta, url, znalezione });
  const bezpieczny = adresBezpieczny(url) ? url : null;
  const id = znalezione ? idPlyty(serwis, url) : null;

  if (b.tryb === "aplikacja" && serwis === "tidal") {
    return NextResponse.json(id ? { ok: true, appUrl: `tidal://album/${id}`, url: bezpieczny } : { ok: false, powod: "brak-plyty", url: bezpieczny });
  }

  if (b.tryb === "graj" && serwis === "spotify") {
    if (!id) return NextResponse.json({ ok: false, powod: "brak-plyty", url: bezpieczny });
    const { currentUser } = await import("@/lib/auth");
    const user = await currentUser().catch(() => null);
    if (!user) return NextResponse.json({ ok: false, powod: "brak-konta", url: bezpieczny });
    const { spotifyGraj } = await import("@/lib/spotify");
    const wynik = await spotifyGraj(user.id, id);
    return NextResponse.json({ ...wynik, url: bezpieczny });
  }

  return NextResponse.json({ ok: false, powod: "blad", url: bezpieczny });
}
