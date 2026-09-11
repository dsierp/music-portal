"use client";

/**
 * Formularz „podróży w nieznane".
 *
 * Klient z dwóch powodów, oba o czekaniu. Po pierwsze to TRWA: model plus
 * weryfikacja kilkunastu pozycji w MusicBrainz to nierzadko pół minuty, a bez
 * widocznego znaku życia człowiek klika drugi raz i powstają dwie podróże oraz
 * dwa rachunki za model. Po drugie — i to było gorsze — poprzedni błąd wisiał
 * na ekranie w trakcie nowej próby, więc wyglądało to tak, jakby dotyczył
 * tego, co właśnie robisz. Teraz znika, gdy tylko coś rusza.
 */
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import type { Dict } from "@/lib/dict";
import { podrozWNieznane } from "@/app/actions";

/** Zaczepki: puste pole onieśmiela, a to pokazuje, jak szczegółowo można pisać. */
const PRZYKLADY = ["exPrime", "exSecond", "exThird"] as const;

function Przycisk({ t }: { t: Dict }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-accent" disabled={pending}>
      {pending ? t.unknown.workingShort : t.unknown.cta}
    </button>
  );
}

/**
 * Znak życia na czas oczekiwania: kręciołek, licznik sekund i to, co się
 * właśnie dzieje. Licznik jest tu najważniejszy — przy czymś, co trwa pół
 * minuty, rosnąca liczba to jedyny dowód, że portal nie zawisł.
 *
 * Etapów nie zgadujemy po czasie. Piszemy wprost, z czego składa się
 * czekanie, bo to prawda niezależnie od tego, gdzie akurat jesteśmy.
 */
function Postep({ t }: { t: Dict }) {
  const { pending } = useFormStatus();
  const [sekundy, setSekundy] = useState(0);

  useEffect(() => {
    if (!pending) {
      setSekundy(0);
      return;
    }
    const id = setInterval(() => setSekundy((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [pending]);

  if (!pending) return null;
  return (
    <div className="flex items-center gap-3 text-sm text-text2" role="status" aria-live="polite">
      <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-rule border-t-accent" aria-hidden />
      <span>
        {t.unknown.working}
        <span className="ml-2 font-mono text-xs text-faint">{sekundy} s</span>
      </span>
    </div>
  );
}

/** Błąd chowamy, gdy leci nowa próba — inaczej wygląda, jakby dotyczył jej. */
function Blad({ stan, t }: { stan: { blad?: string; szczegol?: string }; t: Dict }) {
  const { pending } = useFormStatus();
  if (pending || !stan?.blad) return null;
  const bledy = t.unknown.errors as Record<string, string>;
  return (
    <div className="text-sm text-warn">
      <p>{(bledy[stan.blad] ?? bledy.nieznany).replace("{n}", stan.szczegol ?? "")}</p>
      {/* Różnica między „zły klucz" a „brak środków" to różnica między dwiema
          zupełnie innymi rzeczami do zrobienia. */}
      {stan.szczegol && stan.blad !== "limit" && <p className="mt-1 font-mono text-xs text-faint">{stan.szczegol}</p>}
    </div>
  );
}

export function FormularzNieznane({ t, opis = "" }: { t: Dict; opis?: string }) {
  const [stan, akcja] = useActionState(podrozWNieznane, {} as { blad?: string; szczegol?: string });

  return (
    <form action={akcja} className="space-y-4">
      <label className="label block" htmlFor="opis">{t.unknown.label}</label>
      <textarea
        id="opis"
        name="opis"
        rows={5}
        maxLength={2000}
        defaultValue={opis}
        placeholder={t.unknown.placeholder}
        className="w-full rounded border border-rule bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Przycisk t={t} />
        <Postep t={t} />
      </div>
      <p className="text-xs text-faint">{t.unknown.slowNote}</p>
      <Blad stan={stan} t={t} />

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
    </form>
  );
}
