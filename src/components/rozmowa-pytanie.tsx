"use client";

/**
 * Twoje pytanie w rozmowie, z dwoma rzeczami pod spodem: skopiuj i odtwórz.
 *
 * Po co kopiowanie: dobre pytanie to praca. Chce się je przenieść do innej
 * rozmowy, zawęzić o jedno słowo, wysłać komuś — a zaznaczanie myszką tekstu
 * w kilku wierszach to mordęga.
 *
 * Po co „odtwórz jeszcze raz": to samo pytanie zadane drugi raz daje inne
 * płyty. Nie dlatego, że coś się zepsuło — po prostu szukanie nie jest
 * deterministyczne, a przy niszowych rzeczach drugi przebieg często wyciąga
 * to, czego pierwszy nie dotknął.
 */
import { useState } from "react";
import { useFormStatus } from "react-dom";
import type { Dict } from "@/lib/dict";
import { powtorzPytanie } from "@/app/actions";

function Znowu({ t }: { t: Dict }) {
  const { pending } = useFormStatus();
  return (
    <button className="text-[11px] text-faint hover:text-accent2 disabled:opacity-50" disabled={pending}>
      {pending ? t.chat.workingShort : t.chat.again}
    </button>
  );
}

export function Pytanie({ t, tekst, id }: { t: Dict; tekst: string; id: string }) {
  const [skopiowane, setSkopiowane] = useState(false);

  return (
    <div className="rounded border border-rule bg-surface px-4 py-3">
      <p className="label mb-1">{t.chat.youAsked}</p>
      <p className="text-lg text-text">{tekst}</p>
      <div className="mt-2 flex flex-wrap items-baseline gap-4">
        <button
          type="button"
          className="text-[11px] text-faint hover:text-accent2"
          onClick={async () => {
            // Schowek bywa niedostępny (stara przeglądarka, strona bez https).
            // Wtedy po prostu nic nie mówimy, zamiast wywalać ekran.
            try {
              await navigator.clipboard.writeText(tekst);
              setSkopiowane(true);
              setTimeout(() => setSkopiowane(false), 2000);
            } catch {
              /* trudno */
            }
          }}
        >
          {skopiowane ? t.chat.copied : t.chat.copy}
        </button>
        <form action={powtorzPytanie}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="tekst" value={tekst} />
          <Znowu t={t} />
        </form>
      </div>
    </div>
  );
}
