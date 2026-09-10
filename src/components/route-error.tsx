"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

/**
 * Granica błędu POJEDYNCZEGO ekranu.
 *
 * Bez niej każda awaria — nawet w drobiazgu, którego nikt nie zauważy —
 * wpadała do granicy globalnej i kasowała całą stronę razem z menu i polem
 * szukania. Człowiek zostawał z komunikatem i przyciskiem „strona główna",
 * czyli musiał zaczynać od zera.
 *
 * Tutaj menu i stopka zostają (to layout, jest wyżej), a treść ekranu zamienia
 * się w jeden pasek: co się nie udało i przycisk, który ponawia tylko ten ekran.
 * `reset()` jest pierwszy, bo w większości przypadków wystarcza; `refresh()`
 * dokładamy, żeby serwer poszedł po dane od nowa, a nie oddał tę samą awarię
 * z pamięci.
 */
export function RouteError({
  co,
  error,
  reset,
}: {
  co: string;
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const [ponawiam, start] = useTransition();

  return (
    <div className="py-12">
      <div className="mx-auto max-w-lg rounded-lg border border-warn/40 bg-warn/10 p-4 text-sm">
        <p className="text-text2">
          Nie udało się wczytać: {co}. Reszta portalu działa — możesz szukać dalej albo ponowić.
        </p>
        <p className="mt-1 text-xs text-faint">
          Couldn&apos;t load: {co}. The rest of the portal works.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => start(() => { reset(); router.refresh(); })}
            disabled={ponawiam}
            className="btn btn-accent text-xs disabled:opacity-50"
          >
            Wczytaj ponownie / Load again
          </button>
          <Link href="/" className="btn text-xs">Strona główna / Home</Link>
        </div>
        {/* Skrót wystąpienia — jedyny ślad, po którym da się odnaleźć TEN błąd
            w logach; treść błędu produkcja wycina. */}
        {error.digest && <p className="mt-3 font-mono text-[10px] text-faint">kod / code: {error.digest}</p>}
      </div>
    </div>
  );
}
