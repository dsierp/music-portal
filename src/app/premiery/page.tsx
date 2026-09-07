import Link from "next/link";
import type { Metadata } from "next";
import { ReleaseSection } from "@/components/release-list";
import { Banner } from "@/components/banner";
import { GENRE_LABELS, GENRE_ORDER, allSections, latestSections, releasesFor } from "@/lib/lists";
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
  if (!sp.g && sp.all !== "1" && user) {
    const prefs = await getGenres(user.id);
    const secs = new Set(prefs.filter((p) => p.weight >= 3).map((p) => genreToSection(p.genre)).filter(Boolean) as string[]);
    if (secs.size && secs.size < GENRE_ORDER.length) { genres = GENRE_ORDER.filter((g) => secs.has(g)); fromPrefs = true; }
  }
  const filter = { genres, starOnly: sp.star === "1", showFlagged: sp.re === "1" };
  const sections = sp.sekcja === "archiwum" ? await allSections() : await latestSections(2);
  const rel = await releasesFor(sections.map((s) => s.id));
  const base = { star: sp.star, re: sp.re, sekcja: sp.sekcja };

  return (
    <div className="grid gap-8 md:grid-cols-[220px_1fr]">
      <aside className="md:sticky md:top-20 md:self-start">
        <div className="label mb-2">Gatunki</div>
        <div className="flex flex-wrap gap-1.5">
          {GENRE_ORDER.map((g) => {
            const on = genres.includes(g);
            const next = on ? genres.filter((x) => x !== g) : [...genres, g];
            return (
              <Link key={g} href={qs({ ...base, g: next.join(","), all: next.length ? undefined : "1" })} className={`chip ${on ? "chip-on" : ""}`}>
                {GENRE_LABELS[g]}
              </Link>
            );
          })}
        </div>
        {fromPrefs && <p className="mt-2 text-xs text-muted">Filtr z Twoich preferencji. <Link href={qs({ ...base, all: "1" })} className="underline">Pokaż wszystko</Link></p>}
        <div className="label mt-5 mb-2">Widok</div>
        <div className="flex flex-col gap-1.5 text-sm">
          <Link href={qs({ ...base, g: sp.g, all: sp.all, star: filter.starOnly ? undefined : "1" })} className={`chip ${filter.starOnly ? "chip-on" : ""}`}>Tylko ★</Link>
          <Link href={qs({ ...base, g: sp.g, all: sp.all, re: filter.showFlagged ? undefined : "1" })} className={`chip ${filter.showFlagged ? "chip-on" : ""}`}>Pokaż reedycje / EP / live</Link>
          <Link href={qs({ ...base, g: sp.g, all: sp.all, sekcja: sp.sekcja === "archiwum" ? undefined : "archiwum" })} className={`chip ${sp.sekcja === "archiwum" ? "chip-on" : ""}`}>Archiwum tygodni</Link>
        </div>
        <p className="mt-5 text-xs text-faint">Lista powstaje co piątek z zestawienia „Pure New Shit”. Kliknięcie w tytuł otwiera stronę płyty ze składem — stamtąd ruszasz w podróż.</p>
      </aside>
      <div>
        <Banner image="/img/konsola.jpg" title="Premiery" position="center 55%" compact />
        <div className="mb-6" />
        {sections.map((s) => (
          <ReleaseSection key={s.id} section={s} releases={rel.filter((r) => r.sectionId === s.id)} filter={filter} />
        ))}
        {!sections.length && <p className="text-muted">Brak zaimportowanych premier. Uruchom <code>npm run import:pns</code>.</p>}
      </div>
    </div>
  );
}
