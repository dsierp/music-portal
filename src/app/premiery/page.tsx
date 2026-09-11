import Link from "next/link";
import type { Metadata } from "next";
import { PickCard, ReleaseCard } from "@/components/release-card";
import { ReleaseFilters, type PozycjaFiltru, type SekcjaFiltru } from "@/components/release-filters";
import { Masthead } from "@/components/masthead";
import { heroArt, leadStyle, sectionHeroArt } from "@/lib/lead-style";
import { allSections, genreLabel as genreLabelFallback, latestSections, releasesFor, sectionImage, splitDb, styleToCategory } from "@/lib/lists";
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

export default async function PremieryPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { t } = await i18n();
  const user = await currentUser();
  const prefs = user ? await getGenres(user.id) : [];
  const sections = sp.sekcja === "archiwum" ? await allSections() : await latestSections(2);
  const rel = await releasesFor(sections.map((s) => s.id));

  const lead = leadStyle(prefs);
  // Kategorie: style użytkownika (nawet te bez premier w tym tygodniu — inaczej
  // ktoś, kto wybrał country, nigdy by go tu nie zobaczył), potem to, co jest
  // w danych, ułożone popularnością wśród użytkowników portalu.
  const mine = [...new Set(prefs.slice().sort((a, b) => b.weight - a.weight).map((p) => styleToCategory(p.genre)))];
  const present = [...new Set(rel.map((r) => splitDb(r.genre, r.description)))];
  const cats = mine.length
    ? [...mine, ...(await orderByPopularity(present.filter((g) => !mine.includes(g))))]
    : await orderByPopularity(present);

  // Wszystko, co komponent kliencki może potrzebować, liczymy TUTAJ — on dostaje
  // gotowe karty i etykiety, więc odklikanie kategorii to już tylko schowanie
  // kawałka drzewa, bez pytania serwera o cokolwiek.
  const catLabels: Record<string, string> = {};
  const heroArtMap: Record<string, string> = { db: sectionHeroArt("db") };
  const groupImage: Record<string, string | null> = {};
  for (const g of [...new Set([...cats, ...present])]) {
    catLabels[g] = genreLabel(g, t, genreLabelFallback(g));
    heroArtMap[g] = sectionHeroArt(g);
    groupImage[g] = sectionImage(g);
  }

  const items: PozycjaFiltru[] = rel.map((r) => ({
    id: r.id,
    sectionId: r.sectionId,
    g: splitDb(r.genre, r.description),
    star: r.star,
    flagged: !!r.flag && ["comp", "reissue", "live", "ep"].includes(r.flag),
    node: <ReleaseCard key={r.id} r={r} t={t} />,
  }));

  const sekcje: SekcjaFiltru[] = sections.map((s) => {
    const moje = rel.filter((r) => r.sectionId === s.id);
    // Płyta tygodnia: wskazana w imporcie, a gdy jej nie ma — pierwsze wyróżnienie.
    const pick = moje.find((r) => r.id === `${s.id}:${s.pickId}`) ?? moje.find((r) => r.star === 1);
    return {
      id: s.id,
      title: s.title,
      date: s.date,
      sub: s.sub,
      pickId: pick?.id ?? null,
      pickNode: pick ? <PickCard r={pick} t={t} /> : null,
      podroz: !!user && moje.some((r) => r.mbid),
      podrozTytul: `${s.title} ${s.date}`,
    };
  });

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
      {sections.length ? (
        <ReleaseFilters
          cats={cats}
          catLabels={catLabels}
          domyslne={mine.filter((g) => cats.includes(g))}
          sections={sekcje}
          items={items}
          heroArt={heroArtMap}
          groupImage={groupImage}
          akcjaPodrozy={journeyFromReleases}
          teksty={{
            genresLabel: t.releases.genresLabel,
            viewLabel: t.releases.viewLabel,
            starOnly: t.releases.starOnly,
            showFlagged: t.releases.showFlagged,
            footnote: t.releases.footnote,
            noMatch: t.releases.noMatch,
            journey: t.releases.journeyFromReleases,
            journeyNote: t.releases.journeyFromReleasesNote,
            all: t.common.selectAll,
            none: t.common.selectNone,
            mine: t.common.selectMine,
            jump: t.common.jumpTo,
          }}
        />
      ) : (
        <p className="mt-8 text-muted">{t.releases.noSectionsBefore}<code>npm run import:pns</code>{t.releases.noSectionsAfter}</p>
      )}
    </>
  );
}
