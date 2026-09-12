"use client";

/**
 * `<details>`, które zamyka się kliknięciem obok i klawiszem Escape.
 *
 * Samo `<details>` zwija się wyłącznie po ponownym kliknięciu w nagłówek —
 * a przy menu wiszącym NAD treścią (jak „Do podróży") wygląda to na zacięcie:
 * człowiek klika obok, żeby je zamknąć, i nic się nie dzieje. Przy zwykłych
 * rozwijankach w treści strony byłoby to niepożądane, więc opakowujemy tylko te,
 * które faktycznie coś zasłaniają.
 *
 * Domykanie jest DODATKIEM, nie warunkiem działania: bez JavaScriptu menu dalej
 * otwiera się i zamyka kliknięciem w nagłówek, a formularz w środku to zwykły
 * `<form>`, więc wysyła się tak czy siak.
 */
import { useEffect, useRef, type ReactNode } from "react";

export function MenuZamykane({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const poza = (e: PointerEvent) => {
      const d = ref.current;
      if (d?.open && e.target instanceof Node && !d.contains(e.target)) d.open = false;
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && ref.current?.open) ref.current.open = false;
    };
    // `pointerdown`, nie `click`: zamykamy w chwili naciśnięcia, więc menu nie
    // zdąży przeszkodzić w kliknięciu w to, co pod nim leży.
    document.addEventListener("pointerdown", poza);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", poza);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  return (
    <details ref={ref} className={className}>
      {children}
    </details>
  );
}
