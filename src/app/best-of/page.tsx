import Link from "next/link";
import type { Metadata } from "next";
import { BEST_CATS, BEST_ORDER, bestOf, bestOfYears } from "@/lib/lists";
import { searchLinks } from "@/components/links";

export const metadata: Metadata = { title: "Best of" };
export const dynamic = "force-dynamic";

export default async function BestOfPage({ searchParams }: { searchParams: Promise<{ rok?: string; kat?: string }> }) {
  const sp = await searchParams;
  const years = await bestOfYears();
  const year = sp.rok && years.some((y) => y.year === sp.rok) ? sp.rok : years[0]?.year;
  if (!year) return <p className="text-muted">Brak danych Best of. Uruchom <code>npm run import:pns</code>.</p>;
  const { year: y, entries } = await bestOf(year);
  const cats = sp.kat ? [sp.kat] : BEST_ORDER;

  return (
    <div className="grid gap-8 md:grid-cols-[220px_1fr]">
      <aside className="md:sticky md:top-20 md:self-start">
        <div className="label mb-2">Rok</div>
        <div className="flex gap-1.5">
          {years.map((yy) => (
            <Link key={yy.year} href={`?rok=${yy.year}`} className={`chip ${yy.year === year ? "chip-on" : ""}`}>{yy.label}</Link>
          ))}
        </div>
        <div className="label mt-5 mb-2">Kategorie</div>
        <div className="flex flex-col gap-1.5">
          <Link href={`?rok=${year}`} className={`chip ${!sp.kat ? "chip-on" : ""}`}>wszystkie</Link>
          {BEST_ORDER.map((c) => (
            <Link key={c} href={`?rok=${year}&kat=${c}`} className={`chip ${sp.kat === c ? "chip-on" : ""}`}>{BEST_CATS[c]}</Link>
          ))}
        </div>
      </aside>
      <div>
        <h1 className="text-4xl">Best of {y?.label ?? year}</h1>
        {y?.sub && <p className="text-sm text-muted">{y.sub}</p>}
        {cats.map((c) => {
          const rows = entries.filter((e) => e.category === c);
          if (!rows.length) return null;
          return (
            <section key={c} className="mt-8">
              <h2 className="mb-3 border-b border-rule pb-1 text-2xl">{BEST_CATS[c] ?? c}</h2>
              <ol className="space-y-3">
                {rows.map((e) => {
                  const links = searchLinks(e.artist, e.album);
                  return (
                    <li key={e.id} className="flex gap-3">
                      <span className={`display w-8 shrink-0 text-right text-2xl ${e.rank === 1 ? "text-accent2" : "text-faint"}`}>{e.rank}</span>
                      <div className="min-w-0">
                        <Link href={`/go/best/${e.id}`} className="display text-lg font-semibold hover:text-accent2">
                          {e.artist} – <i>{e.album}</i>
                        </Link>
                        <div className="font-mono text-xs text-muted">
                          {[e.label, e.genre, e.country, e.released].filter(Boolean).join(" · ")}
                        </div>
                        {e.why && <p className="mt-0.5 text-sm text-text2">{e.why}</p>}
                        {e.scores && <p className="text-xs text-muted"><span className="label mr-1">Oceny</span>{e.scores}</p>}
                        <div className="mt-1 flex gap-4 font-mono text-xs">
                          <a href={links.spotify} target="_blank" rel="noopener" className="text-spotify hover:underline">▶ Spotify</a>
                          <a href={links.tidal} target="_blank" rel="noopener" className="text-tidal hover:underline">▶ Tidal</a>
                          <Link href={`/go/best/${e.id}`} className="text-muted hover:text-accent2">skład i podróż →</Link>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </div>
    </div>
  );
}
