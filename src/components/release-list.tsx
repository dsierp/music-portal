import Link from "next/link";
import type { InferSelectModel } from "drizzle-orm";
import { schema } from "@/db";
import { FLAG_LABELS, GENRE_LABELS, GENRE_ORDER, sectionImage } from "@/lib/lists";
import { searchLinks } from "./links";
import { PickCard, ReleaseCard } from "./release-card";
import { SectionHead } from "./masthead";
import { sectionHeroArt } from "@/lib/lead-style";

type Section = InferSelectModel<typeof schema.releaseSections>;
type Release = InferSelectModel<typeof schema.releases>;

export interface ReleaseFilter { genres: string[]; starOnly: boolean; showFlagged: boolean }

export { ReleaseCard as ReleaseRow } from "./release-card";

export function ReleaseSection({ section, releases, filter }: { section: Section; releases: Release[]; filter: ReleaseFilter }) {
  const visible = releases.filter((r) => {
    if (filter.genres.length && !filter.genres.includes(r.genre)) return false;
    if (filter.starOnly && r.star !== 1) return false;
    if (!filter.showFlagged && r.flag && ["comp", "reissue", "live", "ep"].includes(r.flag)) return false;
    return true;
  });
  // Płyta tygodnia: wskazana w imporcie, a gdy jej nie ma — pierwsze wyróżnienie.
  const pick = releases.find((r) => r.id === `${section.id}:${section.pickId}`) ?? releases.find((r) => r.star === 1);
  const rest = visible.filter((r) => r.id !== pick?.id);
  const groups = GENRE_ORDER.map((g) => ({ g, items: rest.filter((r) => r.genre === g) })).filter((x) => x.items.length);
  // Tło nagłówka bierzemy z gatunku, który w tym tygodniu dominuje.
  const lead = groups[0]?.g ?? "db";

  return (
    <section className="mb-12">
      <SectionHead
        image={sectionHeroArt(lead)}
        title={section.title}
        date={section.date}
        note={section.sub}
        count={visible.length}
        variant={lead === "db" ? "red" : lead === "other" ? "morgue" : "other"}
      />
      {pick && !filter.genres.length && <PickCard r={pick} />}
      {groups.map(({ g, items }) => (
        <div key={g} className="mt-6">
          <h3 className="label relative mb-3 overflow-hidden rounded border border-rule px-3 py-2 text-xs">
            {sectionImage(g) && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={sectionImage(g)!} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-25" />
            )}
            <span className="absolute inset-0 bg-gradient-to-r from-bg via-bg/80 to-transparent" />
            <span className="relative">{GENRE_LABELS[g]}</span>
          </h3>
          <ul className="space-y-3">{items.map((r) => <ReleaseCard key={r.id} r={r} />)}</ul>
        </div>
      ))}
      {!groups.length && !pick && <p className="mt-3 text-sm text-muted">Nic nie pasuje do filtrów.</p>}
    </section>
  );
}
