import Link from "next/link";
import { Masthead } from "@/components/masthead";
import { BestPick, BestRow } from "@/components/best-card";
import { BestFilters, type KategoriaBest } from "@/components/best-filters";
import { heroArt, leadStyle, sectionHeroArt } from "@/lib/lead-style";
import { currentUser } from "@/lib/auth";
import { getGenres } from "@/lib/user-data";
import type { Metadata } from "next";
import { BEST_CATS, bestOf, bestOfYears, styleToCategory } from "@/lib/lists";
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

export default async function BestOfPage({ searchParams }: { searchParams: Promise<{ rok?: string }> }) {
  const sp = await searchParams;
  const { t } = await i18n();
  const years = await bestOfYears();
  const year = sp.rok && years.some((y) => y.year === sp.rok) ? sp.rok : years[0]?.year;
  if (!year) return <p className="text-muted">{t.lists.noBestOf}<code>npm run import:pns</code>{t.lists.noBestOfAfter}</p>;
  const { year: y, entries } = await bestOf(year);
  const user = await currentUser();
  const prefs = user ? await getGenres(user.id) : [];
  const lead = leadStyle(prefs);

  // Kategorie bierzemy z TEGO ROCZNIKA, nie ze sztywnej listy: 2025 ma pięć
  // kategorii metalowo-jazzowych, 2026 dwanaście (nowe krótkimi listami).
  const obecne = [...new Set(entries.map((e) => e.category))];
  const moje = [...new Set(prefs.slice().sort((a, b) => b.weight - a.weight).map((g) => styleToCategory(g.genre)))]
    .filter((g) => obecne.includes(g));
  const kolejnosc = [...moje, ...(await orderByPopularity(obecne.filter((c) => !moje.includes(c))))];

  const cats: KategoriaBest[] = kolejnosc.map((c) => {
    const rows = entries.filter((e) => e.category === c);
    const [first, ...rest] = rows;
    const label = genreLabel(c, t, BEST_CATS[c] ?? c);
    return {
      slug: c,
      label,
      ile: rows.length,
      image: sectionHeroArt(c),
      pick: first ? <BestPick e={first} category={label} t={t} /> : null,
      reszta: rest.length ? <ul className="mt-4">{rest.map((e) => <BestRow key={e.id} e={e} t={t} />)}</ul> : null,
    };
  });

  return (
    <>
      <Masthead
        art={heroArt(lead)}
        eyebrow={fmt(t.lists.bestOfYear, { year: y?.label ?? year })}
        title="Pure New Shit"
        meta={y?.sub ? <span>{y.sub}</span> : undefined}
      />
      <BestFilters cats={cats} year={year} label={t.lists.categoriesLabel}>
        <div className="label mb-2">{t.lists.yearLabel}</div>
        <div className="flex gap-1.5">
          {years.map((yy) => (
            <Link key={yy.year} href={`?rok=${yy.year}`} className={`chip ${yy.year === year ? "chip-on" : ""}`}>{yy.label}</Link>
          ))}
        </div>
      </BestFilters>
    </>
  );
}
