import Link from "next/link";
import type { Metadata } from "next";
import { ReleaseSection } from "@/components/release-list";
import { Masthead } from "@/components/masthead";
import { heroArt, leadStyle } from "@/lib/lead-style";
import { GENRE_ORDER, allSections, genreLabel, latestSections, releasesFor, splitDb, styleToCategory } from "@/lib/lists";
import { currentUser } from "@/lib/auth";
import { getGenres } from "@/lib/user-data";
import { genreToSection } from "@/lib/genres";

export const metadata: Metadata = { title: "Premiery" };
export const dynamic = "force-dynamic";

function qs(p: Record<string, string | undefined>) {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v) s.set(k, v);
  const str = s.toString();
  return str ? `?${str}` : "";
}

export default async function PremieryPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await currentUser();
  // domyślne filtry z preferencji użytkownika (jeśli nie wybrał ręcznie)
  let genres = sp.g ? sp.g.split(",").filter(Boolean) : [];
  let fromPrefs = false;
  const prefs = user ? await getGenres(user.id) : [];
  if (!sp.g && sp.all !== "1" && user) {
    const secs = new Set(prefs.filter((p) => p.weight >= 3).map((p) => genreToSection(p.genre)).filter(Boolean) as string[]);
    if (secs.size && secs.size < GENRE_ORDER.length) { genres = GENRE_ORDER.filter((g) => secs.has(g)); fromPrefs = true; }
  }
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
  const available = mine.length
    ? [...mine, ...present.filter((g) => !mine.includes(g))]
    : [
        ...GENRE_ORDER.filter((g) => present.includes(g)),
        ...present.filter((g) => !GENRE_ORDER.includes(g)).sort((a, b) => a.localeCompare(b, "pl")),
      ];
  return (
    <>
    <Masthead
      art={heroArt(lead)}
      eyebrow="Premiery płytowe co piątek"
      title="Pure New Shit"
      meta={
        <>
          {sections[0]?.date && <span>Piątek {sections[0].date}</span>}
          {lead && <span className="ml-4">Twój styl wiodący: <b className="text-accent2">{lead.genre}</b></span>}
          {!lead && <span className="ml-4"><Link href="/ja#style" className="underline">Ustaw swoje style</Link>, żeby portal dobrał oprawę i filtry pod Ciebie.</span>}
        </>
      }
    />
    <div className="mt-8 grid gap-8 md:grid-cols-[220px_1fr]">
      <aside className="md:sticky md:top-20 md:self-start">
        <div className="label mb-2">Gatunki</div>
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
                {genreLabel(g)}
                <span className="ml-1.5 font-mono text-[10px] text-faint">{counts.get(g) ?? 0}</span>
              </Link>
            );
          })}
        </div>
        {fromPrefs && <p className="mt-2 text-xs text-muted">Filtr z Twoich preferencji. <Link href={qs({ ...base, all: "1" })} className="underline">Pokaż wszystko</Link></p>}
        <div className="label mt-5 mb-2">Widok</div>
        <div className="flex flex-col gap-1.5 text-sm">
          <Link href={qs({ ...base, g: sp.g, all: sp.all, star: filter.starOnly ? undefined : "1" })} className={`chip ${filter.starOnly ? "chip-on" : ""}`}>Tylko ★</Link>
          <Link href={qs({ ...base, g: sp.g, all: sp.all, re: filter.showFlagged ? undefined : "1" })} className={`chip ${filter.showFlagged ? "chip-on" : ""}`}>Pokaż reedycje / EP / live</Link>
        </div>
        <p className="mt-5 text-xs text-faint">Lista powstaje co piątek z zestawienia „Pure New Shit”. Kliknięcie w tytuł otwiera stronę płyty ze składem — stamtąd ruszasz w podróż.</p>
      </aside>
      <div>

        {sections.map((s) => (
          <ReleaseSection key={s.id} section={s} releases={rel.filter((r) => r.sectionId === s.id)} filter={filter} />
        ))}
        {!sections.length && <p className="text-muted">Brak zaimportowanych premier. Uruchom <code>npm run import:pns</code>.</p>}
      </div>
    </div>
    </>
  );
}
