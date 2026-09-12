"use client";

/**
 * Pole wiadomości w rozmowie.
 *
 * Po wysłaniu pole i przycisk SCHODZĄ Z EKRANU, a na ich miejsce wchodzi
 * kręciołek z powtórzonym pytaniem. Formularz stojący nieruszony wygląda
 * dokładnie tak, jakby kliknięcie nic nie zrobiło — a wtedy człowiek klika
 * drugi raz i płaci za dwie tury.
 *
 * Tekst zostaje w stanie komponentu, więc nieudana próba nie każe pisać od nowa.
 */
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import type { Dict } from "@/lib/dict";
import { powiedzCos } from "@/app/actions";

function Czekanie({ t, pytanie }: { t: Dict; pytanie: string }) {
  const [sekundy, setSekundy] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSekundy((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="rounded border border-rule bg-surface p-6" role="status" aria-live="polite">
      <div className="flex items-start gap-4">
        <span className="mt-1 h-6 w-6 shrink-0 animate-spin rounded-full border-2 border-rule border-t-accent" aria-hidden />
        <div className="min-w-0 space-y-2">
          <p className="label">{t.chat.youAsked}</p>
          <p className="text-lg text-text">&bdquo;{pytanie}&rdquo;</p>
          <p className="text-sm text-text2">
            {t.chat.working}
            <span className="ml-2 font-mono text-xs text-faint">{sekundy} s</span>
          </p>
        </div>
      </div>
    </div>
  );
}

/** Błąd ma być widać z drugiego końca pokoju — szary wiersz ginął. */
function Blad({ blad, szczegol, t }: { blad?: string; szczegol?: string; t: Dict }) {
  if (!blad) return null;
  const bledy = t.chat.errors as Record<string, string>;
  return (
    <div className="rounded border border-warn bg-warn/10 p-4" role="alert">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 text-lg leading-none text-warn" aria-hidden>!</span>
        <div className="min-w-0">
          <p className="font-medium text-warn">{(bledy[blad] ?? bledy.nieznany).replace("{n}", szczegol ?? "")}</p>
          {/* Techniczny szczegół zostaje w logach — na ekranie portal po prostu
              szuka i czasem nie znajdzie. */}
          {szczegol && blad === "brakKlucza" && <p className="mt-2 break-words font-mono text-xs text-faint">{szczegol}</p>}
        </div>
      </div>
    </div>
  );
}

function Wnetrze({ t, id, start, stan }: { t: Dict; id?: string; start: string; stan: { blad?: string; szczegol?: string } }) {
  const { pending } = useFormStatus();
  // Tekst z adresu: ktoś wraca ze starego adresu albo z gotowej podróży
  // i ma poprawić swoje zdanie, a nie pisać je od nowa.
  const [tekst, setTekst] = useState(start);

  if (pending) return <Czekanie t={t} pytanie={tekst} />;
  return (
    <div className="space-y-3">
      <Blad blad={stan?.blad} szczegol={stan?.szczegol} t={t} />
      {id && <input type="hidden" name="id" value={id} />}
      <label className="label block" htmlFor="tekst">{t.chat.label}</label>
      <textarea
        id="tekst"
        name="tekst"
        rows={3}
        maxLength={2000}
        value={tekst}
        onChange={(e) => setTekst(e.target.value)}
        placeholder={t.chat.placeholder}
        className="w-full rounded border border-rule bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
      />
      <button className="btn btn-accent">{t.chat.send}</button>
    </div>
  );
}

export function RozmowaForm({ t, id, start = "" }: { t: Dict; id?: string; start?: string }) {
  const [stan, akcja] = useActionState(powiedzCos, {} as { blad?: string; szczegol?: string });
  return (
    <form action={akcja}>
      <Wnetrze t={t} id={id} start={start} stan={stan} />
    </form>
  );
}
