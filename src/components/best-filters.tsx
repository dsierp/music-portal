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
import { KategorieFiltru } from "./filter-list";

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
  domyslne,
  year,
  label,
  teksty,
  children,
}: {
  cats: KategoriaBest[];
  /** kategorie z profilu — zaznaczone na starcie */
  domyslne: string[];
  year: string;
  /** nagłówek listy kategorii */
  label: string;
  teksty: { all: string; none: string; mine: string; jump: string };
  /** przełącznik roczników — zostaje linkiem, bo to inne dane z bazy */
  children: ReactNode;
}) {
  const slugi = cats.map((c) => c.slug);
  const [wybrane, setWybrane] = useState<Set<string>>(() => new Set(domyslne.length ? domyslne : slugi));
  const widoczne = cats.filter((c) => wybrane.has(c.slug));

  return (
    <div className="mt-8 grid gap-8 md:grid-cols-[240px_1fr]">
      <aside className="md:sticky md:top-20 md:self-start">
        {children}
        <div className="mt-5">
          <KategorieFiltru
            cats={slugi}
            catLabels={Object.fromEntries(cats.map((c) => [c.slug, c.label]))}
            liczniki={Object.fromEntries(cats.map((c) => [c.slug, c.ile]))}
            wybrane={wybrane}
            setWybrane={setWybrane}
            domyslne={domyslne}
            label={label}
            teksty={teksty}
          />
        </div>
      </aside>
      <div>
        {widoczne.map((c) => (
          <section key={c.slug} data-kat={c.slug} className="mb-12 scroll-mt-24">
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
