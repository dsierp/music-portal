import Link from "next/link";
import type { InferSelectModel } from "drizzle-orm";
import { schema } from "@/db";
import { FLAG_LABELS, GENRE_LABELS, GENRE_ORDER, sectionImage } from "@/lib/lists";
import { searchLinks } from "./links";
import { Cover } from "./cover";

type Section = InferSelectModel<typeof schema.releaseSections>;
type Release = InferSelectModel<typeof schema.releases>;

export interface ReleaseFilter { genres: string[]; starOnly: boolean; showFlagged: boolean }

export function ReleaseRow({ r }: { r: Release }) {
  if (r.star === -1) {
    return (
      <li className="rich border-l-2 border-rule pl-3 text-sm text-text2">
        <span className="label mr-2">mniejsze</span>
        <span dangerouslySetInnerHTML={{ __html: r.description }} />
      </li>
    );
  }
  const links = searchLinks(r.artist ?? "", r.album ?? "");
  return (
    <li
      className={`group relative flex gap-3 overflow-hidden rounded-lg border p-3 transition-colors ${
        r.star ? "border-accent/50 bg-accent/[0.06] hover:border-accent" : "border-rule bg-surface hover:border-accent/50"
      }`}
    >
      {/* Okładka jest tu głównym sygnałem — płytę rozpoznaje się wzrokiem szybciej niż z tytułu.
          Mamy ją tylko dla pozycji rozwiązanych do MusicBrainz; reszta dostaje spokojny placeholder. */}
      <Link href={`/go/release/${encodeURIComponent(r.id)}`} className="shrink-0" aria-hidden tabIndex={-1}>
        {r.mbid ? (
          <Cover mbid={r.mbid} size={88} />
        ) : (
          <div className="h-[88px] w-[88px] shrink-0 rounded bg-surface2 bg-cover bg-center" style={{ backgroundImage: "linear-gradient(rgba(0,0,0,.7),rgba(0,0,0,.7)), url(/img/winyl.jpg)" }} />
        )}
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          {r.star === 1 && <span className="text-accent2" title="strzał tygodnia">★</span>}
          <Link href={`/go/release/${encodeURIComponent(r.id)}`} className="display text-lg font-semibold leading-tight hover:text-accent2">
            {r.artist} – <i>{r.album}</i>
          </Link>
          {r.flag && <span className="rounded bg-warn/20 px-1.5 font-mono text-[10px] uppercase text-warn">{FLAG_LABELS[r.flag] ?? r.flag}</span>}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 font-mono text-[11px] text-muted">
          {r.label && <span>{r.label}</span>}
          {r.dayLabel && <span>{r.dayLabel}</span>}
        </div>
        <p className="rich mt-1 text-sm text-text2" dangerouslySetInnerHTML={{ __html: r.description }} />
        {r.reviews && (
          <p className="rich mt-1 text-xs text-muted">
            <span className="label mr-1">Recenzje</span>
            <span dangerouslySetInnerHTML={{ __html: r.reviews }} />
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-4 font-mono text-xs">
          <a href={links.spotify} target="_blank" rel="noopener" className="text-spotify hover:underline">▶ Spotify</a>
          <a href={links.tidal} target="_blank" rel="noopener" className="text-tidal hover:underline">▶ Tidal</a>
          <Link href={`/go/release/${encodeURIComponent(r.id)}`} className="text-muted hover:text-accent2">skład i podróż →</Link>
        </div>
      </div>
    </li>
  );
}

export function ReleaseSection({ section, releases, filter }: { section: Section; releases: Release[]; filter: ReleaseFilter }) {
  const visible = releases.filter((r) => {
    if (filter.genres.length && !filter.genres.includes(r.genre)) return false;
    if (filter.starOnly && r.star !== 1) return false;
    if (!filter.showFlagged && r.flag && ["comp", "reissue", "live", "ep"].includes(r.flag)) return false;
    return true;
  });
  const pick = releases.find((r) => r.id === `${section.id}:${section.pickId}`) ?? releases.find((r) => r.star === 1);
  const groups = GENRE_ORDER.map((g) => ({ g, items: visible.filter((r) => r.genre === g) })).filter((x) => x.items.length);
  return (
    <section className="mb-10">
      <div className={`rounded-lg border px-4 py-3 ${section.kind === "friday" ? "border-accent/60 bg-accent/10" : "border-rule bg-surface"}`}>
        <h2 className="text-2xl">
          {section.title} <span className="font-mono text-base font-normal text-text2">{section.date}</span>
        </h2>
        {section.sub && <div className="text-xs text-muted">{section.sub}</div>}
      </div>
      {pick && !filter.genres.length && (
        <div className="mt-3 rounded-lg border border-rule bg-surface2 p-4">
          <div className="label mb-1">Strzał tygodnia</div>
          <ul><ReleaseRow r={pick} /></ul>
        </div>
      )}
      {groups.map(({ g, items }) => (
        <div key={g} className="mt-5">
          <h3 className="label relative mb-2 overflow-hidden rounded border border-rule px-3 py-2 text-xs">
            {sectionImage(g) && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={sectionImage(g)!} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-25" />
            )}
            <span className="absolute inset-0 bg-gradient-to-r from-bg via-bg/80 to-transparent" />
            <span className="relative">{GENRE_LABELS[g]}</span>
          </h3>
          <ul className="space-y-2">{items.map((r) => <ReleaseRow key={r.id} r={r} />)}</ul>
        </div>
      ))}
      {!groups.length && <p className="mt-3 text-sm text-muted">Nic nie pasuje do filtrów.</p>}
    </section>
  );
}
