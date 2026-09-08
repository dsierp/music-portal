import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Masthead } from "@/components/masthead";
import { heroArt, leadStyle } from "@/lib/lead-style";
import { currentUser } from "@/lib/auth";
import { getAreas, getFavoriteArtists, getGenres, getUserLocale } from "@/lib/user-data";
import { concertWindow, concertsByArea, concertsByAreaMb, concertsForFavorites, dedupe, hasTicketmasterKey, type Concert } from "@/lib/concerts";
import { dbSafe } from "@/lib/db-safe";
import { i18n } from "@/lib/t";
import { fmt, formatDate, type Locale } from "@/lib/i18n";
import type { Dict } from "@/lib/dict";

/** Tytuł w zakładce też idzie w języku czytelnika. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await i18n();
  return { title: t.concerts.title };
}
export const dynamic = "force-dynamic";

function ConcertList({ items, locale, t }: { items: Concert[]; locale: Locale; t: Dict }) {
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
function GenreChips({ items, wybrany, locale, t }: { items: Concert[]; wybrany: string; locale: Locale; t: Dict }) {
  const licznik = new Map<string, number>();
  for (const c of items) for (const g of c.genres) licznik.set(g, (licznik.get(g) ?? 0) + 1);
  if (licznik.size < 2) return null;
  const lista = [...licznik.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], locale));
  return (
    <div className="mb-3 flex flex-wrap gap-1.5">
      <Link href="/koncerty" className={`chip ${wybrany ? "" : "chip-on"}`}>{t.common.all} <span className="ml-1 font-mono text-[10px] text-muted">{items.length}</span></Link>
      {lista.map(([g, n]) => (
        <Link key={g} href={`/koncerty?g=${encodeURIComponent(g)}`} className={`chip ${wybrany === g ? "chip-on" : ""}`}>
          {g} <span className="ml-1 font-mono text-[10px] text-muted">{n}</span>
        </Link>
      ))}
    </div>
  );
}

/** Koncerty w moich obszarach — osobny strumień, bo to kilka zapytań do TM. */
async function ByArea({ areas, categories, wybrany, locale, t }: { areas: { country: string; city: string | null }[]; categories: string[]; wybrany: string; locale: Locale; t: Dict }) {
  // MusicBrainz zawsze (za darmo), Ticketmaster gdy jest klucz — i scalamy,
  // bo dla czytelnika to jedna lista koncertów w jego mieście.
  const [mb, tm] = await Promise.all([
    concertsByAreaMb(areas).catch(() => []),
    concertsByArea(areas, categories).catch(() => []),
  ]);
  const wszystkie = dedupe([...tm, ...mb]);
  // Filtrujemy dopiero na wyświetlaniu, żeby chipsy zawsze pokazywały pełny
  // obraz tygodnia — inaczej po zawężeniu zniknęłyby pozostałe gatunki.
  const items = wybrany ? wszystkie.filter((c) => c.genres.includes(wybrany)) : wszystkie;
  if (!wszystkie.length) {
    return (
      <p className="text-sm text-muted">
        {t.concerts.nothingInAreas}
        {!hasTicketmasterKey() && t.concerts.mbNotAnAgenda}
      </p>
    );
  }
  return (
    <>
      <GenreChips items={wszystkie} wybrany={wybrany} locale={locale} t={t} />
      {items.length ? (
        <ConcertList items={items} locale={locale} t={t} />
      ) : (
        <p className="text-sm text-muted">{t.concerts.nothingInGenre} <Link href="/koncerty" className="underline">{t.concerts.showAll}</Link></p>
      )}
    </>
  );
}

/** Koncerty ulubionych zespołów — MusicBrainz, jedno zapytanie na zespół (1/s). */
async function ByFavorites({ artists, areas, locale, t }: { artists: { mbid: string; name: string }[]; areas: { country: string; city: string | null }[]; locale: Locale; t: Dict }) {
  const items = await concertsForFavorites(artists, areas).catch(() => []);
  if (!items.length) {
    return <p className="text-sm text-muted">{t.concerts.noFavoriteConcerts}</p>;
  }
  return <ConcertList items={items} locale={locale} t={t} />;
}

export default async function ConcertsPage({ searchParams }: { searchParams: Promise<{ g?: string }> }) {
  const wybrany = (await searchParams).g ?? "";
  const user = await currentUser();
  const profileLocale = user ? await getUserLocale(user.id).catch(() => null) : null;
  const { locale, t } = await i18n(profileLocale);
  const { from, to } = concertWindow();

  if (!user) {
    return (
      <>
        <Masthead art={heroArt(null)} eyebrow={t.concerts.title} title={t.concerts.heroTitle} />
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
              <ByArea areas={genreAreas} categories={categories} wybrany={wybrany} locale={locale} t={t} />
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
              <ByFavorites artists={favs.map((f) => ({ mbid: f.mbid, name: f.name }))} areas={favAreas} locale={locale} t={t} />
            </Suspense>
          )}
        </section>
      </div>
    </>
  );
}
