"use client";

/**
 * Kategorie na ekranie „best of" — odklikiwane na miejscu, jak w premierach.
 *
 * Ten sam powód: chipy były linkami z `?kat=…`, więc każde odznaczenie
 * kategorii to było pełne przeładowanie strony i ponowne pytanie do bazy.
 * Rankingi i tak przychodzą w całości, więc serwer renderuje wszystkie, a tu
 * tylko decydujemy, które pokazać.
 */
import { useState, type ReactNode } from "react";
import { SectionHead } from "./masthead";

export interface KategoriaBest {
  slug: string;
  label: string;
  ile: number;
  image: string;
  pick: ReactNode;
  reszta: ReactNode;
}

export function BestFilters({
  cats,
  year,
  label,
  children,
}: {
  cats: KategoriaBest[];
  year: string;
  /** nagłówek listy chipów */
  label: string;
  /** przełącznik roczników — zostaje linkiem, bo to inne dane z bazy */
  children: ReactNode;
}) {
  const [wylaczone, setWylaczone] = useState<Set<string>>(new Set());
  const widoczne = cats.filter((c) => !wylaczone.has(c.slug));

  return (
    <div className="mt-8 grid gap-8 md:grid-cols-[220px_1fr]">
      <aside className="md:sticky md:top-20 md:self-start">
        {children}
        <div className="label mt-5 mb-2">{label}</div>
        <div className="flex flex-col gap-1.5">
          {cats.map((c) => (
            <button
              key={c.slug}
              type="button"
              aria-pressed={!wylaczone.has(c.slug)}
              onClick={() =>
                setWylaczone((stare) => {
                  const nowe = new Set(stare);
                  if (nowe.has(c.slug)) nowe.delete(c.slug);
                  else nowe.add(c.slug);
                  return nowe;
                })
              }
              className={`chip ${wylaczone.has(c.slug) ? "" : "chip-on"}`}
            >
              {c.label}
              <span className="ml-1.5 font-mono text-[10px] text-faint">{c.ile}</span>
            </button>
          ))}
        </div>
      </aside>
      <div>
        {widoczne.map((c) => (
          <section key={c.slug} className="mb-12">
            <SectionHead
              image={c.image}
              title={c.label}
              date={year}
              count={c.ile}
              variant={c.slug === "death" || c.slug === "db" ? "red" : c.slug === "black" || c.slug === "other" ? "morgue" : "other"}
            />
            {c.pick}
            {c.reszta}
          </section>
        ))}
      </div>
    </div>
  );
}
