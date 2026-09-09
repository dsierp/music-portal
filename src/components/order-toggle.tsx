"use client";

import { useState, type ReactNode } from "react";

/**
 * Przełącznik kolejności płyt — po stronie przeglądarki.
 *
 * Wcześniej były to zwykłe linki `?plyty=nowe`: kliknięcie szło do serwera,
 * a że dyskografia wisi w strumieniowanej sekcji, przez kilka sekund NIC się
 * nie działo — nawet zaznaczenie chipsa. A przecież obie kolejności to ta sama
 * lista, którą już mamy na ekranie. Odwracamy ją na miejscu: reakcja jest
 * natychmiastowa i nie ma po co pytać serwera.
 *
 * Karty przychodzą gotowe (renderuje je serwer) — tutaj tylko decydujemy,
 * w jakiej kolejności je ułożyć.
 */
export function OrderToggle({
  items,
  oldestLabel,
  newestLabel,
  heading,
  before,
}: {
  items: ReactNode[];
  oldestLabel: string;
  newestLabel: string;
  heading: ReactNode;
  /** np. wyróżniona płyta „ta jedna" — zostaje na górze niezależnie od kolejności */
  before?: ReactNode;
}) {
  const [odNajnowszych, setOdNajnowszych] = useState(false);
  const kolejnosc = odNajnowszych ? [...items].reverse() : items;
  return (
    <>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        {heading}
        <div className="flex gap-1">
          <button type="button" onClick={() => setOdNajnowszych(false)} className={`chip text-[11px] ${odNajnowszych ? "" : "chip-on"}`}>
            {oldestLabel}
          </button>
          <button type="button" onClick={() => setOdNajnowszych(true)} className={`chip text-[11px] ${odNajnowszych ? "chip-on" : ""}`}>
            {newestLabel}
          </button>
        </div>
      </div>
      {before}
      <div className="grid gap-2 sm:grid-cols-2">{kolejnosc}</div>
    </>
  );
}
