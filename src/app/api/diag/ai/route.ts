import { NextResponse } from "next/server";
import { odmowaDlaNieadmina } from "@/lib/admin-guard";

/**
 * Diagnostyka modelu — dla administratora, bez ujawniania klucza.
 *
 * Powstała z tego samego powodu, co diagnostyka Spotify: ekran mówił „Nie udało
 * się nic wyszukać", a to zdanie pada tak samo przy złym kluczu, nieistniejącej
 * nazwie modelu, wyczerpanym limicie i chwilowej awarii. Vercel nie oddaje
 * sekretów z powrotem, więc nie da się tego sprawdzić z panelu.
 *
 * Robi JEDNO prawdziwe zapytanie do dostawcy (odpowiedz „ok") i pokazuje, co
 * odpowiedział. O kluczu mówi tylko długość i czy nie ma spacji albo cudzysłowu
 * na końcu — bo właśnie to najczęściej psuje wklejanie do panelu.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const odmowa = await odmowaDlaNieadmina();
  if (odmowa) return odmowa;
  const opis = (v: string) => ({
    ustawiona: Boolean(v),
    dlugosc: v.length,
    czysty: v === v.trim(),
    wCudzyslowie: /^["'].*["']$/.test(v),
  });
  const base = process.env.AI_BASE_URL ?? "";
  const klucz = process.env.AI_API_KEY ?? "";
  const model = process.env.AI_MODEL ?? "";

  const wynik: Record<string, unknown> = {
    AI_BASE_URL: { ...opis(base), wartosc: base.replace(/\/\/[^/]*@/, "//…@") },
    AI_API_KEY: opis(klucz),
    AI_MODEL: { ...opis(model), wartosc: model },
    OPENROUTER_API_KEY: opis(process.env.OPENROUTER_API_KEY ?? ""),
    ANTHROPIC_API_KEY: opis(process.env.ANTHROPIC_API_KEY ?? ""),
  };

  if (base && klucz && model) {
    const adres = base.replace(/\/+$/, "").endsWith("/chat/completions")
      ? base.replace(/\/+$/, "")
      : `${base.replace(/\/+$/, "")}/chat/completions`;
    wynik.adresWolany = adres;
    try {
      const res = await fetch(adres, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${klucz}` },
        body: JSON.stringify({ model, messages: [{ role: "user", content: "odpowiedz jednym slowem: ok" }], max_tokens: 5 }),
        signal: AbortSignal.timeout(30_000),
      });
      const tekst = await res.text();
      wynik.odpowiedz = { status: res.status, tresc: tekst.slice(0, 500) };
    } catch (e) {
      wynik.odpowiedz = { blad: e instanceof Error ? e.message : String(e) };
    }
  } else {
    wynik.odpowiedz = "Nie pytam — brakuje którejś z trzech zmiennych.";
  }
  return NextResponse.json(wynik, { headers: { "cache-control": "no-store" } });
}
