"use client";

/**
 * Formularz „podróży w nieznane".
 *
 * Rzecz najważniejsza: to TRWA — model plus weryfikacja kilkunastu pozycji
 * w MusicBrainz to nierzadko pół minuty. Dlatego na czas czekania formularz
 * SCHODZI Z EKRANU i na jego miejsce wchodzi jedno: kręciołek, to, o co
 * poprosiłeś, i licznik sekund. Wcześniej formularz stał nieruszony, więc
 * wyglądało to tak, jakby kliknięcie nic nie zrobiło — a wtedy człowiek klika
 * drugi raz i powstają dwie podróże oraz dwa rachunki za model.
 *
 * Pole zostaje w drzewie (schowane), bo wpisany tekst ma wrócić, gdy coś się
 * nie uda albo gdy ktoś przerwie czekanie.
 */
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import type { Dict } from "@/lib/dict";
import { podrozWNieznane } from "@/app/actions";

/** Zaczepki: puste pole onieśmiela, a to pokazuje, jak szczegółowo można pisać. */
const PRZYKLADY = ["exPrime", "exSecond", "exThird"] as const;

/**
 * Ekran czekania. Zastępuje formularz, więc musi sam z siebie tłumaczyć, co się
 * dzieje: kręciołek (że żyje), powtórzony opis (na co czekam) i licznik sekund
 * (jedyny dowód, że to idzie do przodu, gdy trwa pół minuty).
 */
function Czekanie({ t, opis }: { t: Dict; opis: string }) {
  const [sekundy, setSekundy] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSekundy((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="rounded border border-rule bg-surface p-6" role="status" aria-live="polite">
      <div className="flex items-start gap-4">
        <span
          className="mt-1 h-6 w-6 shrink-0 animate-spin rounded-full border-2 border-rule border-t-accent"
          aria-hidden
        />
        <div className="min-w-0 space-y-2">
          <p className="label">{t.unknown.youAsked}</p>
          <p className="text-lg text-text">&bdquo;{opis}&rdquo;</p>
          <p className="text-sm text-text2">
            {t.unknown.working}
            <span className="ml-2 font-mono text-xs text-faint">{sekundy} s</span>
          </p>
        </div>
      </div>
      {/* Przerwanie to zwyczajne przeładowanie ekranu — serwera nie zatrzymamy,
          ale człowiek przestaje być uwięziony w czekaniu, którego nie chce. */}
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-5 text-sm text-muted underline underline-offset-4 hover:text-text"
      >
        {t.unknown.cancel}
      </button>
    </div>
  );
}

/** Błąd ma być widać z drugiego końca pokoju — wcześniej ginął jako szary wiersz. */
function Blad({ stan, t }: { stan: { blad?: string; szczegol?: string }; t: Dict }) {
  if (!stan?.blad) return null;
  const bledy = t.unknown.errors as Record<string, string>;
  return (
    <div className="rounded border border-warn bg-warn/10 p-4" role="alert">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 text-lg leading-none text-warn" aria-hidden>!</span>
        <div className="min-w-0">
          <p className="font-medium text-warn">{(bledy[stan.blad] ?? bledy.nieznany).replace("{n}", stan.szczegol ?? "")}</p>
          {/* Różnica między „zły klucz" a „brak środków" to różnica między dwiema
              zupełnie innymi rzeczami do zrobienia. */}
          {stan.szczegol && stan.blad === "brakKlucza" && (
            <p className="mt-2 break-words font-mono text-xs text-faint">{stan.szczegol}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Wnętrze formularza. Osobny komponent, bo `useFormStatus` czyta stan tylko
 * z wnętrza `<form>`.
 */
function Wnetrze({ t, opis, stan }: { t: Dict; opis: string; stan: { blad?: string; szczegol?: string } }) {
  const { pending } = useFormStatus();
  const [tekst, setTekst] = useState(opis);

  return (
    <>
      {pending && <Czekanie t={t} opis={tekst} />}
      {/* Schowane, nie odmontowane: wpisany tekst ma przetrwać nieudaną próbę. */}
      <div className={pending ? "hidden" : "space-y-4"}>
        {/* Błąd nad polem, nie pod przyciskiem — czytamy od góry. */}
        <Blad stan={stan} t={t} />
        <label className="label block" htmlFor="opis">{t.unknown.label}</label>
        <textarea
          id="opis"
          name="opis"
          rows={5}
          maxLength={2000}
          value={tekst}
          onChange={(e) => setTekst(e.target.value)}
          placeholder={t.unknown.placeholder}
          className="w-full rounded border border-rule bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button className="btn btn-accent">{t.unknown.cta}</button>
        <p className="text-xs text-faint">{t.unknown.slowNote}</p>

        <div className="pt-4">
          <p className="label mb-2">{t.unknown.examplesLabel}</p>
          <ul className="space-y-1 text-sm text-muted">
            {PRZYKLADY.map((k) => (
              <li key={k} className="before:mr-2 before:text-faint before:content-['—']">
                {(t.unknown as unknown as Record<string, string>)[k]}
              </li>
            ))}
          </ul>
        </div>
        <p className="pt-2 text-xs text-faint">{t.unknown.honestNote}</p>
      </div>
    </>
  );
}

export function FormularzNieznane({ t, opis = "" }: { t: Dict; opis?: string }) {
  const [stan, akcja] = useActionState(podrozWNieznane, {} as { blad?: string; szczegol?: string });

  return (
    <form action={akcja}>
      <Wnetrze t={t} opis={opis} stan={stan} />
    </form>
  );
}
