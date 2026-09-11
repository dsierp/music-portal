"use client";

/**
 * Formularz „podróży w nieznane".
 *
 * Klient tylko dlatego, że to trwa: model plus weryfikacja kilkunastu pozycji
 * w MusicBrainz to nierzadko pół minuty. Bez stanu oczekiwania człowiek klika
 * drugi raz, a wtedy powstają dwie podróże i dwa rachunki za model.
 */
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { Dict } from "@/lib/dict";
import { podrozWNieznane } from "@/app/actions";

/** Zaczepki: pole puste onieśmiela, a to pokazuje, jak szczegółowo można pisać. */
const PRZYKLADY = ["exPrime", "exSecond", "exThird"] as const;

function Przycisk({ t }: { t: Dict }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-accent" disabled={pending}>
      {pending ? t.unknown.working : t.unknown.cta}
    </button>
  );
}

export function FormularzNieznane({ t }: { t: Dict }) {
  const [stan, akcja] = useActionState(podrozWNieznane, {} as { blad?: string; szczegol?: string });
  const bledy = t.unknown.errors as Record<string, string>;

  return (
    <form action={akcja} className="space-y-4">
      <label className="label block" htmlFor="opis">{t.unknown.label}</label>
      <textarea
        id="opis"
        name="opis"
        rows={5}
        maxLength={2000}
        placeholder={t.unknown.placeholder}
        className="w-full rounded border border-rule bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Przycisk t={t} />
        <span className="text-xs text-faint">{t.unknown.slowNote}</span>
      </div>
      {stan?.blad && (
        <div className="text-sm text-warn">
          <p>{(bledy[stan.blad] ?? bledy.nieznany).replace("{n}", stan.szczegol ?? "")}</p>
          {/* Bez tego każdy problem z modelem wygląda tak samo — a różnica
              między „zły klucz" a „brak środków" to różnica między dwiema
              zupełnie innymi rzeczami do zrobienia. */}
          {stan.szczegol && stan.blad !== "limit" && <p className="mt-1 font-mono text-xs text-faint">{stan.szczegol}</p>}
        </div>
      )}

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
