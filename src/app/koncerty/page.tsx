import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Masthead } from "@/components/masthead";
import { AddToList } from "@/components/add-to-list";
import { heroArt, leadStyle } from "@/lib/lead-style";
import { currentUser } from "@/lib/auth";
import { getAreas, getFavoriteArtists, getGenres, getUserLocale, getMyLists } from "@/lib/user-data";
import { acceptedLabels, concertWindow, concertsByArea, concertsByAreaMb, concertsForFavorites, dedupe, hasTicketmasterKey, matchesGenres, offGenre, type Concert } from "@/lib/concerts";
import { dbSafe } from "@/lib/db-safe";
import { i18n } from "@/lib/t";
import { ScreenHelp } from "@/components/screen-help";
import { fmt, formatDate, type Locale } from "@/lib/i18n";
import type { Dict } from "@/lib/dict";

/** Tytuł w zakładce też idzie w języku czytelnika. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await i18n();
  return { title: t.concerts.title };
}
export const dynamic = "force-dynamic";

function ConcertList({
  items,
  locale,
  t,
  lists,
}: {
  items: Concert[];
  locale: Locale;
  t: Dict;
  /** listy zalogowanego — koncert też można komuś polecić */
  lists?: { id: string; title: string }[];
}) {
  return (
    <ul className="space-y-2">
      {items.map((c) => (
        <li key={c.id} className="rounded-lg border border-rule bg-surface2 px-3 py-2">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <span className="font-mono text-xs text-accent2">{formatDate(c.date, locale)}{c.time ? `, ${c.time.slice(0, 5)}` : ""}</span>
            {c.url ? (
              <a href={c.url} target="_blank" rel="noopener" className="display text-lg leading-tight hover:text-accent2 hover:underline">{c.name}</a>
            ) : (
              <span className="display text-lg leading-tight">{c.name}</span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-xs text-muted">
            {c.venue && <span>{c.venue}</span>}
            {c.city && <span>· {c.city}{c.country ? `, ${c.country}` : ""}</span>}
            {c.artistName && (
              <span>
                · {t.concerts.fromFavorites}{" "}
                <Link href={`/artist/${c.artistMbid}`} className="hover:text-accent2 hover:underline">★ {c.artistName}</Link>
              </span>
            )}
            {/* Nazwy własne źródeł danych — nie tłumaczymy. */}
            <span className="font-mono text-[10px] text-faint">{c.source === "ticketmaster" ? "Ticketmaster" : "MusicBrainz"}</span>
          </div>
          {lists && (
            <div className="mt-1">
              <AddToList
                type="CONCERT"
                mbid={c.id}
                label={`${c.name}${c.city ? ` — ${c.city}` : ""} (${c.date})`}
                url={c.url}
                lists={lists}
                already={[]}
                t={{
                  addTo: t.lists.addTo,
                  pick: t.lists.pickList,
                  newList: t.lists.orNewList,
                  newPlaceholder: t.lists.newListPlaceholder,
                  add: t.lists.addToSubmit,
                  onList: t.lists.onLists,
                }}
              />
            </div>
          )}
          {c.genres.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {c.genres.slice(0, 3).map((g) => <span key={g} className="chip text-[10px]">{g}</span>)}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * Chipsy gatunków dla listy koncertów.
 *
 * Świadomie liczone z TEGO, CO PRZYSZŁO, a nie ze sztywnej listy: Ticketmaster
 * ma własny słownik („Death Metal/Black Metal", „A Cappella") i lepiej pokazać
 * etykiety, które faktycznie są w wynikach, razem z liczbą koncertów. Wybór
 * siedzi w adresie (?g=), więc zawężoną listę da się wysłać linkiem.
 */
function GenreChips({
  items,
  wybrany,
  moje,
  wszystko,
  locale,
  t,
}: {
  /** wszystko, co przyszło — chipsy mają pokazywać pełny obraz, nie tylko wynik filtra */
  items: Concert[];
  wybrany: string;
  /** etykiety uznane za „moje gatunki" — te chipsy są zaznaczone domyślnie */
  moje: string[];
  wszystko: boolean;
  locale: Locale;
  t: Dict;
}) {
  const licznik = new Map<string, number>();
  for (const c of items) for (const g of c.genres) licznik.set(g, (licznik.get(g) ?? 0) + 1);
  if (licznik.size < 2) return null;
  const chce = moje.map((g) => g.toLowerCase());
  const mojeEtykiety = new Set(
    [...licznik.keys()].filter((g) => chce.some((w) => g.toLowerCase() === w || g.toLowerCase().includes(w))),
  );
  const sortuj = (a: [string, number], b: [string, number]) => b[1] - a[1] || a[0].localeCompare(b[0], locale);
  const lista = [...licznik.entries()].sort(sortuj);
  const mojeChipsy = lista.filter(([g]) => mojeEtykiety.has(g));
  const resztaChipsy = lista.filter(([g]) => !mojeEtykiety.has(g));
  const link = (g: string) => `/koncerty?g=${encodeURIComponent(g)}${wszystko ? "&w=1" : ""}`;

  return (
    <div className="mb-3 space-y-1.5">
      {/* Moje gatunki: zaznaczone z góry, bez klikania. Reszta jest obok —
          „niech sobie będą", ale nie udają, że to moja muzyka. */}
      <div className="flex flex-wrap gap-1.5">
        <Link href={wszystko ? "/koncerty?w=1" : "/koncerty"} className={`chip ${wybrany ? "" : "chip-on"}`}>
          {t.concerts.myGenresChip}{" "}
          <span className="ml-1 font-mono text-[10px] text-muted">
            {items.filter((c) => !c.genres.length || c.genres.some((g) => mojeEtykiety.has(g))).length}
          </span>
        </Link>
        {mojeChipsy.map(([g, n]) => (
          <Link key={g} href={link(g)} className={`chip ${wybrany === g ? "chip-on" : ""}`}>
            {g} <span className="ml-1 font-mono text-[10px] text-muted">{n}</span>
          </Link>
        ))}
      </div>
      {resztaChipsy.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-widest text-faint">{t.concerts.otherGenresLabel}</span>
          {resztaChipsy.map(([g, n]) => (
            <Link key={g} href={link(g)} className={`chip text-faint ${wybrany === g ? "chip-on" : ""}`}>
              {g} <span className="ml-1 font-mono text-[10px]">{n}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** Koncerty w moich obszarach — osobny strumień, bo to kilka zapytań do TM. */
async function ByArea({
  areas,
  categories,
  wybrany,
  wszystko,
  locale,
  t,
  lists,
}: {
  areas: { country: string; city: string | null }[];
  categories: string[];
  wybrany: string;
  /** ?w=1 — pokaż też to, co Ticketmaster dorzucił poza moimi gatunkami */
  wszystko: boolean;
  locale: Locale;
  t: Dict;
  lists?: { id: string; title: string }[];
}) {
  // MusicBrainz zawsze (za darmo), Ticketmaster gdy jest klucz — i scalamy,
  // bo dla czytelnika to jedna lista koncertów w jego mieście.
  const [mb, tm] = await Promise.all([
    concertsByAreaMb(areas).catch(() => []),
    concertsByArea(areas, categories).catch(() => []),
  ]);
  const zebrane = dedupe([...tm, ...mb]);
  // Ticketmaster traktuje gatunek jak podpowiedź, nie filtr — stąd Melanie
  // Martinez w wynikach zapytania o metal. Odsiewamy to, co ma etykiety i żadna
  // nie pasuje; koncerty bez etykiet zostają, bo o nich po prostu nic nie wiemy.
  // Do zapytania szedł szeroki gatunek („Metal", „Rock"), ale do filtrowania
  // bierzemy podgatunki: dla TM prog rock i pop-rockowy support to ten sam
  // „Rock", a to nie jest ta sama muzyka.
  const moje = acceptedLabels(categories);
  const obce = zebrane.filter((c) => offGenre(c, moje));
  // Domyślnie widać MOJE gatunki. Konkretny chips zawęża do jednej etykiety —
  // także spoza moich, bo skoro ktoś w nią kliknął, to chce właśnie tego.
  const items = wybrany
    ? zebrane.filter((c) => c.genres.includes(wybrany))
    : wszystko
      ? zebrane
      : zebrane.filter((c) => matchesGenres(c, moje));
  if (!zebrane.length) {
    return (
      <p className="text-sm text-muted">
        {t.concerts.nothingInAreas}
        {!hasTicketmasterKey() && ` ${t.concerts.mbNotAnAgenda}`}
      </p>
    );
  }
  return (
    <>
      <GenreChips items={zebrane} wybrany={wybrany} moje={moje} wszystko={wszystko} locale={locale} t={t} />
      {items.length ? (
        <ConcertList items={items} locale={locale} t={t} lists={lists} />
      ) : (
        <p className="text-sm text-muted">
          {t.concerts.nothingInGenre} <Link href="/koncerty" className="underline">{t.common.showAll}</Link>
        </p>
      )}
      {/* Uczciwie mówimy, ile schowaliśmy i czemu — zamiast po cichu ucinać. */}
      {obce.length > 0 && (
        <p className="mt-3 font-mono text-[10px] text-faint">
          {fmt(t.concerts.hiddenOffGenre, { n: obce.length })}{" "}
          <Link href={wszystko ? "/koncerty" : "/koncerty?w=1"} className="underline">
            {wszystko ? t.concerts.hideOffGenre : t.concerts.showOffGenre}
          </Link>
        </p>
      )}
    </>
  );
}

/** Koncerty ulubionych zespołów — MusicBrainz, jedno zapytanie na zespół (1/s). */
async function ByFavorites({ artists, areas, locale, t, lists }: { artists: { mbid: string; name: string }[]; areas: { country: string; city: string | null }[]; locale: Locale; t: Dict; lists?: { id: string; title: string }[] }) {
  const items = await concertsForFavorites(artists, areas).catch(() => []);
  if (!items.length) {
    return <p className="text-sm text-muted">{t.concerts.noFavoriteConcerts}</p>;
  }
  return <ConcertList items={items} locale={locale} t={t} lists={lists} />;
}

export default async function ConcertsPage({ searchParams }: { searchParams: Promise<{ g?: string; w?: string }> }) {
  const params = await searchParams;
  const wybrany = params.g ?? "";
  const wszystko = params.w === "1";
  const user = await currentUser();
  const profileLocale = user ? await getUserLocale(user.id).catch(() => null) : null;
  const { locale, t } = await i18n(profileLocale);
  const { from, to } = concertWindow();

  if (!user) {
    return (
      <>
        <Masthead art={heroArt(null)} eyebrow={t.concerts.title} title={t.concerts.heroTitle} />
      <ScreenHelp screen="koncerty" />
        <p className="mt-8 text-sm text-muted">
          <Link href="/login" className="underline">{t.nav.logIn}</Link> {t.concerts.loginIntro}
        </p>
      </>
    );
  }

  const [areasS, genresS, favsS] = await Promise.all([
    dbSafe(getAreas(user.id), [] as Awaited<ReturnType<typeof getAreas>>),
    dbSafe(getGenres(user.id), [] as Awaited<ReturnType<typeof getGenres>>),
    dbSafe(getFavoriteArtists(user.id), [] as Awaited<ReturnType<typeof getFavoriteArtists>>),
  ]);
  const allAreas = areasS.value;
  const genreAreas = allAreas.filter((a) => a.scope === "genres");
  const favAreas = allAreas.filter((a) => a.scope === "favorites");
  const genres = genresS.value;
  const favs = favsS.value;
  const lead = leadStyle(genres);
  const categories = genres.filter((g) => g.weight >= 3).map((g) => g.genre);
  // Koncert też można komuś polecić — listy ładujemy raz, dla całej strony.
  const mojeListy = await getMyLists(user.id).catch(() => []);

  return (
    <>
      <Masthead
        art={heroArt(lead)}
        eyebrow={t.concerts.title}
        title={t.concerts.heroTitle}
        meta={
          <>
            <span>{formatDate(from, locale)} – {formatDate(to, locale)}</span>
            <span className="ml-4">
              {allAreas.length
                ? allAreas.map((a) => (a.city ? `${a.city} (${a.country})` : a.country)).join(" · ")
                : <Link href="/ja#obszary" className="underline">{t.concerts.setAreas}</Link>}
            </span>
          </>
        }
      />

      <div className="mt-8 space-y-10">
        <section>
          <h2 className="text-3xl">{t.concerts.inYourGenres}</h2>
          <p className="mb-3 text-sm text-muted">
            {t.concerts.inYourGenresIntro}{" "}
            {hasTicketmasterKey() ? t.concerts.tmWithKey : t.concerts.tmWithoutKey}{" "}
            <Link href="/ja#obszary" className="underline">{t.concerts.changeAreas}</Link>
          </p>
          {!genreAreas.length ? (
            <p className="text-sm text-muted">
              {t.concerts.noAreasYet} <Link href="/ja#obszary" className="underline">{t.concerts.addCityOrCountry}</Link>{t.concerts.addAreaTail}
            </p>
          ) : (
            <Suspense fallback={<p className="font-mono text-xs text-muted">{t.concerts.loadingAreaConcerts}</p>}>
              <ByArea areas={genreAreas} categories={categories} wybrany={wybrany} wszystko={wszystko} locale={locale} t={t} lists={mojeListy} />
            </Suspense>
          )}
        </section>

        <section>
          <h2 className="text-3xl">{t.concerts.favoriteBands}</h2>
          <p className="mb-3 text-sm text-muted">
            {favAreas.length
              ? fmt(t.concerts.narrowedTo, { areas: favAreas.map((a) => (a.city ? `${a.city} (${a.country})` : a.country)).join(", ") })
              : t.concerts.noNarrowing}
          </p>
          {!favs.length ? (
            <p className="text-sm text-muted">{t.concerts.noFavoritesYet}</p>
          ) : (
            <Suspense fallback={<p className="font-mono text-xs text-muted">{t.concerts.loadingFavoriteConcerts}</p>}>
              <ByFavorites artists={favs.map((f) => ({ mbid: f.mbid, name: f.name }))} areas={favAreas} locale={locale} t={t} lists={mojeListy} />
            </Suspense>
          )}
        </section>
      </div>
    </>
  );
}
