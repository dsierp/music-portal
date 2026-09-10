"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * Zakresy wyników szukania.
 *
 * Klik w zakres zmienia SAMO PYTANIE do MusicBrainz (inny typ = więcej trafień
 * tego rodzaju), więc rundy do serwera nie da się uniknąć — a ta trwa sekundy,
 * bo MusicBrainz przyjmuje jedno zapytanie na sekundę. Bez potwierdzenia
 * wygląda to jak martwy przycisk: klikasz i nic.
 *
 * Dlatego zaznaczenie przenosimy od razu, a listę przygaszamy na czas
 * pobierania. Nadal są to zwykłe odnośniki — działają w nowej karcie i dają się
 * skopiować, bo wynik szukania ma się dać wysłać komuś linkiem.
 */
export function FilterChips({
  items,
  active,
  hrefFor,
}: {
  items: { id: string; label: string; count: number | null }[];
  active: string;
  hrefFor: (id: string) => string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  // Optymistycznie: zaznaczamy klikniętego, zanim serwer odpowie.
  const [wybrany, setWybrany] = useState(active);

  return (
    <div className={`mt-3 flex flex-wrap gap-1.5 ${pending ? "opacity-60" : ""}`}>
      {items.map((x) => (
        <Link
          key={x.id || "all"}
          href={hrefFor(x.id)}
          className={`chip ${wybrany === x.id ? "chip-on" : ""}`}
          onClick={(e) => {
            // Zwykły klik obsługujemy sami; Ctrl/⌘/środkowy zostawiamy
            // przeglądarce, żeby dało się otworzyć w nowej karcie.
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            setWybrany(x.id);
            start(() => router.push(hrefFor(x.id)));
          }}
        >
          {x.label}
          {x.count !== null && <span className="ml-1 font-mono text-[10px] text-muted">{x.count}</span>}
        </Link>
      ))}
    </div>
  );
}
