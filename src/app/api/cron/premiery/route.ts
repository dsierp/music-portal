import { NextResponse, type NextRequest } from "next/server";

/**
 * Piątkowe premiery same z siebie — zadanie w tle Vercela.
 *
 * DLACZEGO TO ISTNIEJE: zaciąganie premier z MusicBrainz było skryptem
 * odpalanym z laptopa. Działało dokładnie wtedy, gdy ktoś o nim pamiętał,
 * więc portal potrafił wejść w poniedziałek z zeszłotygodniową listą.
 *
 * ZABEZPIECZENIE: Vercel woła ten adres z nagłówkiem `Authorization: Bearer
 * $CRON_SECRET`. Bez ustawionego sekretu nie wpuszczamy nikogo — inaczej
 * dowolny przechodzień mógłby kazać portalowi odpytać MusicBrainz kilkaset
 * razy. Ten sam sekret pozwala odpalić to ręcznie z konsoli.
 *
 * Powtórzenia są bezpieczne: sekcja tygodnia ma stałe id i jest nadpisywana.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const sekret = (process.env.CRON_SECRET ?? "").trim();
  if (!sekret) return NextResponse.json({ blad: "Brak CRON_SECRET." }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${sekret}`) {
    return NextResponse.json({ blad: "Nie." }, { status: 401 });
  }
  const { zaciagnijPremiery, zaTydzien } = await import("@/lib/premiery-tygodnia");
  try {
    // Ten tydzień i następny. Portal ma odpowiadać na dwa pytania naraz:
    // „co wyszło dziś" i „co wychodzi w przyszły piątek" — MusicBrainz zna
    // zapowiedzi, więc nie ma powodu czekać z nimi do premiery.
    const teraz = await zaciagnijPremiery();
    const nastepny = await zaciagnijPremiery(zaTydzien()).catch(() => null);
    return NextResponse.json({ ok: true, ...teraz, nastepnyTydzien: nastepny });
  } catch (e) {
    return NextResponse.json({ ok: false, blad: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
