"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

/**
 * Kawałek strony, którego nie udało się wczytać — i przycisk, który ponawia
 * TYLKO to.
 *
 * Do tej pory jedna nieudana rzecz (baza ocen, MusicBrainz) zabierała cały
 * ekran: „Coś poszło nie tak" i tyle. To nieuczciwe wobec czytelnika, bo
 * reszta strony zwykle jest w porządku — a i tak nie wiadomo było, co
 * właściwie padło. Tu mówimy wprost, czego brakuje, i zostawiamy resztę.
 *
 * Ponowienie to `router.refresh()`, czyli świeże pobranie danych serwerowych
 * bez przeładowania strony: pozycja na stronie, otwarte sekcje i wpisany tekst
 * zostają na miejscu.
 */
export function PartFail({ what, retryLabel }: { what: string; retryLabel: string }) {
  const router = useRouter();
  const [wczytuje, start] = useTransition();

  return (
    <div className="my-3 flex flex-wrap items-center gap-3 rounded border border-warn/40 bg-warn/10 px-3 py-2 text-sm">
      <span className="text-text2">{what}</span>
      <button
        onClick={() => start(() => router.refresh())}
        disabled={wczytuje}
        className="btn text-xs disabled:opacity-50"
      >
        {retryLabel}
      </button>
    </div>
  );
}

/** Sam przycisk — do pasków, które mają już własną treść (np. ostrzeżenie o bazie). */
export function RetryButton({ label }: { label: string }) {
  const router = useRouter();
  const [wczytuje, start] = useTransition();
  return (
    <button
      onClick={() => start(() => router.refresh())}
      disabled={wczytuje}
      className="btn mt-2 text-xs disabled:opacity-50"
    >
      {label}
    </button>
  );
}
