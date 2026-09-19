import Link from "next/link";
import type { Metadata } from "next";
import { PickCard, ReleaseCard } from "@/components/release-card";
import { ReleaseFilters, type PozycjaFiltru, type SekcjaFiltru } from "@/components/release-filters";
import { Masthead } from "@/components/masthead";
import { heroArt, leadStyle, sectionHeroArt } from "@/lib/lead-style";
import { allSections, dataPozycji, genreLabel as genreLabelFallback, jeszczeNieWyszla, latestSections, releasesFor, sectionImage, splitDb, styleToCategory } from "@/lib/lists";
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
  /**
   * JEDEN PIĄTEK NA EKRANIE — tak jak Best of pokazuje jeden rocznik.
   *
   * Było inaczej i to był bałagan: każde źródło zakładało własną sekcję, więc
   * na jeden piątek wypadały dwa afisze („Tydzień 12–18.09" z zestawienia
   * i „Nowe wydania 18.09" z MusicBrainz), a pod nimi jeszcze poprzedni
   * tydzień. Cztery nagłówki, z czego połowa z napisem „Nic nie pasuje do
   * filtrów". Teraz: przełącznik dat u góry, pod nim JEDNA sekcja z tego dnia,
   * scalona ze wszystkich źródeł.
   */
  const wszystkieSekcje = await allSections();
  const terminy = [...new Map(wszystkieSekcje.map((s) => [s.date, s.sortDate.getTime()])).entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([date]) => date);
  const wybranaData = sp.piatek && terminy.includes(sp.piatek) ? sp.piatek : terminy[0];
  const zTegoDnia = wszystkieSekcje.filter((s) => s.date === wybranaData);
  const rel = await releasesFor(zTegoDnia.map((s) => s.id));
  // Wszystkie pozycje dnia lądują w jednej, scalonej sekcji.
  const SCALONA = `dzien:${wybranaData ?? "brak"}`;
  const glowna = zTegoDnia.find((s) => s.kind !== "mb") ?? zTegoDnia[0];
  const sections = glowna && rel.length ? [{ ...glowna, id: SCALONA }] : [];

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

  // Data premiery per wiersz — potrzebna, żeby nie proponować Spotify przy
  // płycie, która wychodzi dopiero w przyszły piątek.
  const dataSekcji = new Map(zTegoDnia.map((s) => [s.id, s.date]));
  const kiedy = (r: (typeof rel)[number]) => {
    const d = dataPozycji(r.dayLabel, dataSekcji.get(r.sectionId) ?? "");
    return jeszczeNieWyszla(d) ? (r.dayLabel?.replace(/^\D+/, "") ?? d!.toLocaleDateString("pl-PL")) : null;
  };

  const items: PozycjaFiltru[] = rel.map((r) => ({
    id: r.id,
    sectionId: SCALONA,
    g: splitDb(r.genre, r.description),
    star: r.star,
    flagged: !!r.flag && ["comp", "reissue", "live", "ep"].includes(r.flag),
    node: <ReleaseCard key={r.id} r={r} t={t} odKiedy={kiedy(r)} />,
  }));

  const sekcje: SekcjaFiltru[] = sections.map((s) => {
    const moje = rel;
    // Płyta tygodnia: wskazana w imporcie (id ma prefiks SWOJEJ sekcji, nie
    // scalonej), a gdy jej nie ma — pierwsze wyróżnienie.
    const pick =
      moje.find((r) => zTegoDnia.some((x) => r.id === `${x.id}:${x.pickId}`)) ??
      moje.find((r) => r.star === 1);
    return {
      id: s.id,
      title: t.releases.fridayPrefix,
      date: s.date,
      sub: null,
      pickId: pick?.id ?? null,
      pickNode: pick ? <PickCard r={pick} t={t} odKiedy={kiedy(pick)} /> : null,
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
            {wybranaData && <span>{t.releases.fridayPrefix} {wybranaData}</span>}
            {lead && <span className="ml-4">{t.releases.leadGenre} <b className="text-accent2">{lead.genre}</b></span>}
            {!lead && <span className="ml-4"><Link href="/ja#style" className="underline">{t.releases.setStyles}</Link>{t.releases.setStylesRest}</span>}
          </>
        }
      />
      <ScreenHelp screen="premiery" />
      {/* Przełącznik piątków — dokładnie jak roczniki w Best of. */}
      {terminy.length > 1 && (
        <div className="mt-6">
          <div className="label mb-2">{t.releases.fridayPrefix}</div>
          <div className="flex flex-wrap gap-1.5">
            {terminy.slice(0, 12).map((d) => (
              <Link key={d} href={`?piatek=${encodeURIComponent(d)}`} className={`chip ${d === wybranaData ? "chip-on" : ""}`}>
                {d}
              </Link>
            ))}
          </div>
        </div>
      )}
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
            topLabel: t.releases.topLabel,
            showMore: t.releases.showMore,
            showLess: t.releases.showLess,
          }}
        />
      ) : (
        <p className="mt-8 text-muted">{t.releases.noSectionsBefore}<code>npm run import:pns</code>{t.releases.noSectionsAfter}</p>
      )}
    </>
  );
}
