"use client";

import { useState } from "react";

/**
 * Filtry rodzajów wydawnictw na osi czasu — i zarazem opis oznaczeń.
 *
 * Legenda i filtr to tutaj jedno: każdy guzik mówi, co znaczy dany kolor,
 * i jednym kliknięciem ten rodzaj chowa. Osobna legenda „do czytania" obok
 * osobnych filtrów „do klikania" byłaby dwoma spisami tego samego.
 *
 * DLACZEGO PRZEZ KLASY, A NIE PRZEZ PRZERYSOWANIE: sam wykres to SVG liczone
 * na serwerze (kilkaset elementów, zero javascriptu). Gdyby filtr miał go
 * przerysowywać, całość musiałaby pojechać do przeglądarki jako komponent
 * kliencki. Zamiast tego serwer podpisuje każdy znacznik klasą rodzaju, a ten
 * guzik przestawia jedną klasę na opakowaniu — resztę robi CSS. Wykres zostaje
 * serwerowy i działa też wtedy, gdy javascript nie wstanie; wtedy po prostu
 * widać wszystko, co jest stanem domyślnym.
 */
export type RodzajWydania = "studio" | "live" | "ep" | "kompilacja" | "inne";

export function OsFiltry({
  rodzaje,
  etykiety,
  opis,
  children,
}: {
  /** rodzaje faktycznie obecne na wykresie — nie pokazujemy filtrów do pustki */
  rodzaje: { rodzaj: RodzajWydania; kolor: string; szer: number; krycie: number }[];
  etykiety: Record<RodzajWydania, string>;
  /** zdanie pod filtrami: co te oznaczenia znaczą */
  opis: string;
  children: React.ReactNode;
}) {
  const [ukryte, setUkryte] = useState<Set<RodzajWydania>>(() => new Set());
  const przelacz = (r: RodzajWydania) =>
    setUkryte((p) => {
      const n = new Set(p);
      if (n.has(r)) n.delete(r);
      else n.add(r);
      return n;
    });

  const klasy = [...ukryte].map((r) => `ukryj-${r}`).join(" ");

  return (
    <div className={klasy}>
      {children}
      {rodzaje.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {rodzaje.map(({ rodzaj, kolor, szer, krycie }) => {
            const wylaczony = ukryte.has(rodzaj);
            return (
              <button
                key={rodzaj}
                type="button"
                onClick={() => przelacz(rodzaj)}
                aria-pressed={!wylaczony}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors ${
                  wylaczony ? "border-rule text-faint line-through" : "border-rule text-muted hover:border-accent2 hover:text-accent2"
                }`}
              >
                <span
                  className="inline-block h-3 shrink-0"
                  style={{ width: szer + 1, background: kolor, opacity: wylaczony ? 0.25 : krycie + 0.25 }}
                />
                {etykiety[rodzaj]}
              </button>
            );
          })}
        </div>
      )}
      <p className="mt-1.5 text-[10px] text-faint">{opis}</p>
    </div>
  );
}
