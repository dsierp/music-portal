import Link from "next/link";
import { Masthead, SectionHead } from "@/components/masthead";
import { BestPick, BestRow } from "@/components/best-card";
import { heroArt, leadStyle, sectionHeroArt } from "@/lib/lead-style";
import { currentUser } from "@/lib/auth";
import { getGenres } from "@/lib/user-data";
import type { Metadata } from "next";
import { BEST_CATS, BEST_ORDER, bestOf, bestOfYears } from "@/lib/lists";
import { genreLabel } from "@/lib/dict";
import { orderByPopularity } from "@/lib/popularity";
import { i18n } from "@/lib/t";
import { fmt } from "@/lib/i18n";

/** Tytuł w zakładce też idzie w języku czytelnika. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await i18n();
  return { title: t.nav.bestOf };
}
export const dynamic = "force-dynamic";

export default async function BestOfPage({ searchParams }: { searchParams: Promise<{ rok?: string; kat?: string }> }) {
  const sp = await searchParams;
  const { t } = await i18n();
  const years = await bestOfYears();
  const year = sp.rok && years.some((y) => y.year === sp.rok) ? sp.rok : years[0]?.year;
  if (!year) return <p className="text-muted">{t.lists.noBestOf}<code>npm run import:pns</code>{t.lists.noBestOfAfter}</p>;
  const { year: y, entries } = await bestOf(year);
  const user = await currentUser();
  const lead = leadStyle(user ? await getGenres(user.id) : []);
  const chosenCats = sp.kat ? sp.kat.split(",").filter(Boolean) : [];
  // Kolejność kategorii: najpierw style użytkownika, potem popularność.
  const myCats = [...new Set((user ? await getGenres(user.id) : []).slice().sort((a, b) => b.weight - a.weight).map((g) => g.genre))]
    .filter((g) => BEST_ORDER.includes(g));
  const byPop = await orderByPopularity(BEST_ORDER.filter((c) => !myCats.includes(c)));
  const order = [...myCats, ...byPop];
  const cats = chosenCats.length ? order.filter((c) => chosenCats.includes(c)) : order;

  return (
    <>
    <Masthead
      art={heroArt(lead)}
      eyebrow={fmt(t.lists.bestOfYear, { year: y?.label ?? year })}
      title="Pure New Shit"
      meta={y?.sub ? <span>{y.sub}</span> : undefined}
    />
    <div className="mt-8 grid gap-8 md:grid-cols-[220px_1fr]">
      <aside className="md:sticky md:top-20 md:self-start">
        <div className="label mb-2">{t.lists.yearLabel}</div>
        <div className="flex gap-1.5">
          {years.map((yy) => (
            <Link key={yy.year} href={`?rok=${yy.year}`} className={`chip ${yy.year === year ? "chip-on" : ""}`}>{yy.label}</Link>
          ))}
        </div>
        <div className="label mt-5 mb-2">{t.lists.categoriesLabel}</div>
        {/* Brak wyboru = wszystkie kategorie włączone. Klik wyłącza/włącza pojedynczą,
            więc nie ma osobnego przycisku „wszystkie" — pusty wybór to i tak komplet. */}
        <div className="flex flex-col gap-1.5">
          {order.map((c) => {
            const chosen = sp.kat ? sp.kat.split(",").filter(Boolean) : [];
            const on = !chosen.length || chosen.includes(c);
            const next = chosen.length
              ? chosen.includes(c) ? chosen.filter((x) => x !== c) : [...chosen, c]
              : order.filter((x) => x !== c);
            const q = next.length && next.length < order.length ? `?rok=${year}&kat=${next.join(",")}` : `?rok=${year}`;
            return (
              <Link key={c} href={q} className={`chip ${on ? "chip-on" : ""}`}>{genreLabel(c, t, BEST_CATS[c])}</Link>
            );
          })}
        </div>
      </aside>
      <div>
        {cats.map((c) => {
          const rows = entries.filter((e) => e.category === c);
          if (!rows.length) return null;
          const [first, ...rest] = rows;
          const label = genreLabel(c, t, BEST_CATS[c] ?? c);
          return (
            <section key={c} className="mb-12">
              <SectionHead
                image={sectionHeroArt(c)}
                title={label}
                date={year}
                count={rows.length}
                variant={c === "death" || c === "db" ? "red" : c === "black" || c === "other" ? "morgue" : "other"}
              />
              {first && <BestPick e={first} category={label} t={t} />}
              {rest.length > 0 && <ul className="mt-4">{rest.map((e) => <BestRow key={e.id} e={e} t={t} />)}</ul>}
            </section>
          );
        })}
      </div>
    </div>
    </>
  );
}
