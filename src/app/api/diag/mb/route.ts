import { NextResponse } from "next/server";
import { odmowaDlaNieadmina } from "@/lib/admin-guard";
import { mbBase, mbMinGapMs, mbUserAgent } from "@/lib/musicbrainz";

/**
 * Diagnostyka MusicBrainz — dokąd portal właściwie pyta i jak szybko odpowiada.
 *
 * Po co: po przełączeniu na WŁASNĄ KOPIĘ bazy wszystko wygląda tak samo jak
 * przedtem — strony się ładują, dane są — i nie ma jak sprawdzić, czy portal
 * naprawdę chodzi do kopii, czy dalej stoi w kolejce do musicbrainz.org.
 * Ta strona mówi to wprost: adres, odstęp między zapytaniami i czas jednej
 * prawdziwej odpowiedzi. Kopia odpowiada w milisekundach, publiczny serwis
 * w setkach milisekund plus kolejka.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  const odmowa = await odmowaDlaNieadmina();
  if (odmowa) return odmowa;

  const base = mbBase();
  const wlasnaKopia = !/(^|\/\/)([^/]*\.)?musicbrainz\.org/.test(base);
  const wynik: Record<string, unknown> = {
    adres: base,
    wlasnaKopia,
    odstepMs: mbMinGapMs(),
    userAgent: mbUserAgent(),
    // Własna kopia bez odstępu to sedno całej zmiany — gdy ktoś ustawi adres,
    // a zapomni o odstępie, portal dalej dusi się sekundą na zapytanie.
    uwaga: wlasnaKopia
      ? mbMinGapMs() > 0
        ? "Własna kopia z odstępem — ustaw MUSICBRAINZ_MIN_GAP_MS=0, inaczej limit zostaje."
        : null
      : "Publiczny MusicBrainz: 1 zapytanie na sekundę na CAŁY portal.",
  };

  // Jedno prawdziwe zapytanie, celowo BEZ kolejki i bufora: mierzymy serwer,
  // a nie to, jak szybko odpowiada nasza własna pamięć.
  const url = new URL(`${base}/artist/83d91898-7763-47d7-b03b-b92132375c47`);
  url.searchParams.set("fmt", "json");
  const start = Date.now();
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": mbUserAgent(), Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const tekst = await res.text();
    wynik.proba = {
      status: res.status,
      ms: Date.now() - start,
      nazwa: (() => {
        try {
          return (JSON.parse(tekst) as { name?: string }).name ?? null;
        } catch {
          return tekst.slice(0, 200);
        }
      })(),
    };
  } catch (e) {
    wynik.proba = { ms: Date.now() - start, blad: e instanceof Error ? e.message : String(e) };
  }

  return NextResponse.json(wynik);
}
