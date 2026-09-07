import Link from "next/link";
import type { InferSelectModel } from "drizzle-orm";
import { schema } from "@/db";
import { FLAG_LABELS, GENRE_LABELS, GENRE_ORDER } from "@/lib/lists";
import { searchLinks } from "./links";

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
    <li className={`border-l-2 pl-3 ${r.star ? "border-accent" : "border-rule"}`}>
      <div className="flex flex-wrap items-baseline gap-x-2">
        {r.star ? <span className="text-accent2">★</span> : <span className="text-faint">·</span>}
        <Link href={`/go/release/${encodeURIComponent(r.id)}`} className="display text-lg font-semibold hover:text-accent2">
          {r.artist} – <i>{r.album}</i>
        </Link>
        {r.label && <span className="text-xs text-muted">({r.label})</span>}
        {r.flag && <span className="rounded bg-warn/20 px-1.5 font-mono text-[10px] uppercase text-warn">{FLAG_LABELS[r.flag] ?? r.flag}</span>}
        {r.dayLabel && <span className="font-mono text-xs text-muted">{r.dayLabel}</span>}
      </div>
      <p className="rich mt-0.5 text-sm text-text2" dangerouslySetInnerHTML={{ __html: r.description }} />
      {r.reviews && (
        <p className="rich mt-0.5 text-xs text-muted">
          <span className="label mr-1">Recenzje</span>
          <span dangerouslySetInnerHTML={{ __html: r.reviews }} />
        </p>
      )}
      <div className="mt-1 flex gap-4 font-mono text-xs">
        <a href={links.spotify} target="_blank" rel="noopener" className="text-spotify hover:underline">▶ Spotify</a>
        <a href={links.tidal} target="_blank" rel="noopener" className="text-tidal hover:underline">▶ Tidal</a>
        <Link href={`/go/release/${encodeURIComponent(r.id)}`} className="text-muted hover:text-accent2">skład i podróż →</Link>
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
          <h3 className="label mb-2 border-b border-rule pb-1 text-xs">{GENRE_LABELS[g]}</h3>
          <ul className="space-y-3">{items.map((r) => <ReleaseRow key={r.id} r={r} />)}</ul>
        </div>
      ))}
      {!groups.length && <p className="mt-3 text-sm text-muted">Nic nie pasuje do filtrów.</p>}
    </section>
  );
}
