import Link from "next/link";
import type { Metadata } from "next";
import { ReleaseSection } from "@/components/release-list";
import { Masthead } from "@/components/masthead";
import { heroArt, leadStyle } from "@/lib/lead-style";
import { allSections, genreLabel as genreLabelFallback, latestSections, releasesFor, splitDb, styleToCategory } from "@/lib/lists";
import { genreLabel } from "@/lib/dict";
import { orderByPopularity } from "@/lib/popularity";
import { currentUser } from "@/lib/auth";
import { getGenres } from "@/lib/user-data";
import { i18n } from "@/lib/t";
import { ScreenHelp } from "@/components/screen-help";
import { journeyFromReleases } from "@/app/actions";

/** Tytuł w zakładce też idzie w języku czytelnika. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await i18n();
  return { title: t.nav.releases };
}
export const dynamic = "force-dynamic";

function qs(p: Record<string, string | undefined>) {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v) s.set(k, v);
  const str = s.toString();
  return str ? `?${str}` : "";
}

export default async function PremieryPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { t } = await i18n();
  const user = await currentUser();
  // domyślne filtry z preferencji użytkownika (jeśli nie wybrał ręcznie)
  const genres = sp.g ? sp.g.split(",").filter(Boolean) : [];
  const prefs = user ? await getGenres(user.id) : [];
  // Preferencje NIE odznaczają kategorii — domyślnie widać wszystko, co jest
  // w tym tygodniu. Wpływają tylko na kolejność chipów (najpierw Twoje style)
  // i na oprawę graficzną. Zawężanie zostaje w rękach klikającego.
  const filter = { genres, starOnly: sp.star === "1", showFlagged: sp.re === "1" };
  const sections = sp.sekcja === "archiwum" ? await allSections() : await latestSections(2);
  const rel = await releasesFor(sections.map((s) => s.id));
  const base = { star: sp.star, re: sp.re, sekcja: sp.sekcja };

  const lead = leadStyle(prefs);
  // Kategorie biorą się z tego, co faktycznie jest w tym tygodniu — łącznie ze
  // stylami dobranymi z MusicBrainz. Sztywna czwórka z importu PNS to za mało,
  // gdy ktoś słucha country albo klasyki.
  // Filtry pokazują STYLE UŻYTKOWNIKA (z profilu), a nie tylko to, co akurat
  // jest w danych — inaczej ktoś, kto wybrał country, nigdy by go tu nie zobaczył.
  // Przy każdym piszemy, ile pozycji ma w tym tygodniu; zero = kategoria bez premier.
  const counts = new Map<string, number>();
  for (const r of rel) {
    const g = splitDb(r.genre, r.description);
    counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  const mine = [...new Set(prefs.slice().sort((a, b) => b.weight - a.weight).map((p) => styleToCategory(p.genre)))];
  const present = [...counts.keys()];
  // Bez preferencji (albo bez logowania) kolejność robi popularność, nie
  // sztywna lista z zestawienia — pierwszy ekran ma zaczynać od tego, czego
  // słucha najwięcej ludzi.
  const available = mine.length
    ? [...mine, ...(await orderByPopularity(present.filter((g) => !mine.includes(g))))]
    : await orderByPopularity(present);
  return (
    <>
    <Masthead
      art={heroArt(lead)}
      eyebrow={t.releases.eyebrow}
      title="Pure New Shit"
      meta={
        <>
          {sections[0]?.date && <span>{t.releases.fridayPrefix} {sections[0].date}</span>}
          {lead && <span className="ml-4">{t.releases.leadGenre} <b className="text-accent2">{lead.genre}</b></span>}
          {!lead && <span className="ml-4"><Link href="/ja#style" className="underline">{t.releases.setStyles}</Link>{t.releases.setStylesRest}</span>}
        </>
      }
    />
    <ScreenHelp screen="premiery" />
    <div className="mt-8 grid gap-8 md:grid-cols-[220px_1fr]">
      <aside className="md:sticky md:top-20 md:self-start">
        <div className="label mb-2">{t.releases.genresLabel}</div>
        <div className="flex flex-wrap gap-1.5">
          {available.map((g) => {
            // Puste filtry = wszystko włączone, więc chipy świecą się domyślnie;
            // pierwszy klik wyłącza jedną kategorię, a nie włącza pojedynczą.
            const on = !genres.length || genres.includes(g);
            const next = genres.length
              ? genres.includes(g) ? genres.filter((x) => x !== g) : [...genres, g]
              : available.filter((x) => x !== g);
            return (
              <Link key={g} href={qs({ ...base, g: next.join(","), all: next.length ? undefined : "1" })} className={`chip ${on ? "chip-on" : ""}`}>
                {genreLabel(g, t, genreLabelFallback(g))}
                <span className="ml-1.5 font-mono text-[10px] text-faint">{counts.get(g) ?? 0}</span>
              </Link>
            );
          })}
        </div>
        <div className="label mt-5 mb-2">{t.releases.viewLabel}</div>
        <div className="flex flex-col gap-1.5 text-sm">
          <Link href={qs({ ...base, g: sp.g, all: sp.all, star: filter.starOnly ? undefined : "1" })} className={`chip ${filter.starOnly ? "chip-on" : ""}`}>{t.releases.starOnly}</Link>
          <Link href={qs({ ...base, g: sp.g, all: sp.all, re: filter.showFlagged ? undefined : "1" })} className={`chip ${filter.showFlagged ? "chip-on" : ""}`}>{t.releases.showFlagged}</Link>
        </div>
        <p className="mt-5 text-xs text-faint">{t.releases.footnote}</p>
      </aside>
      <div>

        {sections.map((s) => (
          <div key={s.id}>
            <ReleaseSection section={s} releases={rel.filter((r) => r.sectionId === s.id)} filter={filter} t={t} />
            {/* Podróż z tego, co i tak jest na ekranie — jeden klik zamiast
                dwudziestu „dodaj do podróży". */}
            {user && rel.some((r) => r.sectionId === s.id && r.mbid) && (
              <form action={journeyFromReleases} className="mb-8 mt-2">
                <input type="hidden" name="sectionId" value={s.id} />
                <input type="hidden" name="title" value={`${s.title} ${s.date}`} />
                {/* Filtr z ekranu jedzie razem z formularzem — podróż ma być
                    zapisem tego, co widać, a nie osobnym wyborem portalu. */}
                <input type="hidden" name="genres" value={filter.genres.join(",")} />
                <input type="hidden" name="star" value={filter.starOnly ? "1" : "0"} />
                <input type="hidden" name="re" value={filter.showFlagged ? "1" : "0"} />
                <button className="btn btn-accent">{t.releases.journeyFromReleases}</button>
                <span className="ml-2 text-[10px] text-faint">{t.releases.journeyFromReleasesNote}</span>
              </form>
            )}
          </div>
        ))}
        {!sections.length && <p className="text-muted">{t.releases.noSectionsBefore}<code>npm run import:pns</code>{t.releases.noSectionsAfter}</p>}
      </div>
    </div>
    </>
  );
}
