"use client";

/**
 * Lista kategorii do odklikiwania — wspólna dla premier i best of.
 *
 * Wygląd jest stąd, a nie z każdego ekranu osobno, bo wcześniej premiery miały
 * chipy ciasno zawijane w dwóch kolumnach, a best of jeden pod drugim na całą
 * szerokość. Ta sama rzecz w dwóch miejscach wyglądała inaczej i w wersji
 * zawijanej trudno było trafić w kategorię wzrokiem.
 */
import type { Dispatch, SetStateAction } from "react";

export function KategorieFiltru({
  cats,
  catLabels,
  liczniki,
  wybrane,
  setWybrane,
  domyslne,
  label,
  teksty,
}: {
  cats: string[];
  catLabels: Record<string, string>;
  liczniki: Record<string, number>;
  wybrane: Set<string>;
  setWybrane: Dispatch<SetStateAction<Set<string>>>;
  /** kategorie z profilu — cel przycisku „moje" */
  domyslne: string[];
  label: string;
  teksty: { all: string; none: string; mine: string; jump: string };
}) {
  /**
   * Skok do kategorii. Przy dwunastu kategoriach i siedemdziesięciu pozycjach
   * dotarcie wzrokiem do klasyki to pół minuty kręcenia rolką — a lista
   * kategorii i tak stoi obok, więc niech od razu tam prowadzi.
   *
   * Szukamy pierwszego wystąpienia: w premierach ten sam gatunek jest w dwóch
   * sekcjach (piątek i tydzień), a chodzi o to, żeby wylądować na górze bloku.
   */
  function skocz(g: string) {
    document.querySelector(`[data-kat="${CSS.escape(g)}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function przelacz(g: string) {
    setWybrane((stare) => {
      const nowe = new Set(stare);
      if (nowe.has(g)) nowe.delete(g);
      else nowe.add(g);
      return nowe;
    });
  }

  const wszystkie = wybrane.size === cats.length;
  const tylkoMoje =
    domyslne.length > 0 && wybrane.size === domyslne.length && domyslne.every((g) => wybrane.has(g));

  return (
    <>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="label">{label}</span>
        <span className="flex gap-2 text-[10px] text-faint">
          <button type="button" onClick={() => setWybrane(new Set(cats))} disabled={wszystkie} className="underline hover:text-accent2 disabled:no-underline disabled:opacity-40">
            {teksty.all}
          </button>
          {domyslne.length > 0 && (
            <button type="button" onClick={() => setWybrane(new Set(domyslne))} disabled={tylkoMoje} className="underline hover:text-accent2 disabled:no-underline disabled:opacity-40">
              {teksty.mine}
            </button>
          )}
          <button type="button" onClick={() => setWybrane(new Set())} disabled={!wybrane.size} className="underline hover:text-accent2 disabled:no-underline disabled:opacity-40">
            {teksty.none}
          </button>
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {cats.map((g) => {
          const on = wybrane.has(g);
          return (
            <div key={g} className={`chip w-full justify-between gap-1 ${on ? "chip-on" : ""}`}>
              {/* Nazwa włącza i wyłącza kategorię… */}
              <button type="button" aria-pressed={on} onClick={() => przelacz(g)} className="min-w-0 flex-1 truncate text-left">
                {catLabels[g] ?? g}
              </button>
              <span className="shrink-0 font-mono text-[10px] text-faint">{liczniki[g] ?? 0}</span>
              {/* …a strzałka przewija do niej na liście. Ma sens tylko wtedy,
                  gdy kategoria jest w ogóle pokazana. */}
              {on && (
                <button
                  type="button"
                  onClick={() => skocz(g)}
                  title={teksty.jump}
                  aria-label={`${teksty.jump}: ${catLabels[g] ?? g}`}
                  className="shrink-0 px-0.5 text-faint hover:text-accent2"
                >
                  ↓
                </button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
