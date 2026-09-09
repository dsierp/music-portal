"use client";

import { useState, type ReactNode } from "react";

/**
 * Filtr instrumentów nad składem — po stronie przeglądarki.
 *
 * Cały skład jest już na stronie; filtr to wyłącznie kwestia tego, co pokazać.
 * Wcześniej robił to adres `?i=guitar`, czyli pełna runda do serwera przy
 * każdym kliknięciu — a że skład wisi w strumieniowanej sekcji, wyglądało to
 * jak przycisk, który nie działa.
 *
 * Ukrywanie robi CSS (reguły `.lineup[data-filter=…]` w globals.css) po
 * atrybucie `data-i` na pozycji listy. Dzięki temu serwer nadal renderuje całą
 * listę raz, a tu przestawiamy jeden atrybut.
 */
export function LineupFilter({
  counts,
  labels,
  allLabel,
  total,
  children,
}: {
  /** ile osób w każdej grupie instrumentów — chipsy pokazujemy tylko dla tych, które są */
  counts: Record<string, number>;
  labels: Record<string, string>;
  allLabel: string;
  total: number;
  children: ReactNode;
}) {
  const [wybrany, setWybrany] = useState("");
  const grupy = Object.keys(counts);
  // Przy jednej grupie nie ma czego filtrować — chipsy tylko by zaśmiecały.
  if (grupy.length < 2) return <>{children}</>;
  return (
    <>
      <div className="mb-2 flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setWybrany("")} className={`chip text-[11px] ${wybrany ? "" : "chip-on"}`}>
          {allLabel} <span className="ml-1 font-mono text-[10px] text-muted">{total}</span>
        </button>
        {grupy.map((g) => (
          <button key={g} type="button" onClick={() => setWybrany(g)} className={`chip text-[11px] ${wybrany === g ? "chip-on" : ""}`}>
            {labels[g] ?? g} <span className="ml-1 font-mono text-[10px] text-muted">{counts[g]}</span>
          </button>
        ))}
      </div>
      <div className="lineup" data-filter={wybrany || undefined}>
        {children}
      </div>
    </>
  );
}
