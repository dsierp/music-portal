import { NextResponse } from "next/server";

/**
 * Co teraz gra — osobnym zapytaniem, już po wyświetleniu strony.
 *
 * DLACZEGO OSOBNO: kafelek siedział w strumieniu strony głównej, a ta potrafi
 * mielić kilkadziesiąt sekund (MusicBrainz, Wikipedia). Człowiek patrzył więc
 * na stronę bez kafelka i miał prawo sądzić, że funkcja nie działa — choć
 * Spotify odpowiadał od razu. Teraz strona pokazuje się od razu, a kafelek
 * dochodzi sam i sam się odświeża, gdy utwór się zmieni.
 *
 * Cisza jest normalnym stanem: `null` znaczy „nic nie leci albo nie wiemy",
 * i wtedy po stronie przeglądarki po prostu nic się nie rysuje.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const { currentUser } = await import("@/lib/auth");
  const user = await currentUser();
  if (!user) return NextResponse.json({ teraz: null });
  const { nowPlaying, spotifyConfigured } = await import("@/lib/spotify");
  if (!spotifyConfigured()) return NextResponse.json({ teraz: null });
  const teraz = await nowPlaying(user.id).catch(() => null);
  return NextResponse.json({ teraz }, { headers: { "cache-control": "no-store" } });
}
