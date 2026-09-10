import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchBox } from "@/components/search-box";
import { AlbumCard, ArtistCard, Empty } from "@/components/cards";
import { FilterChips } from "@/components/filter-chips";
import { ListSkeleton } from "@/components/skeleton";
import { searchAlbums, searchAlbumsBy, searchArtists } from "@/lib/musicbrainz";
import { ratingAverages } from "@/lib/user-data";
import { dbSafe } from "@/lib/db-safe";
import { PartFail } from "@/components/part-fail";
import { currentUser } from "@/lib/auth";
import { addLikedFromSearch } from "@/app/actions";
import { localAlbums, localAlbumsBy } from "@/lib/local-search";
import { i18n } from "@/lib/t";
import { ScreenHelp } from "@/components/screen-help";
import { fmt } from "@/lib/i18n";
import Link from "next/link";

// Tytuł karty przeglądarki zostaje po polsku jak na sąsiednich ekranach
// (/premiery, /koncerty…) — te strony tłumaczy inny agent razem z <head>.
/** Tytuł w zakładce też idzie w języku czytelnika. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await i18n();
  return { title: t.nav.search };
}
export const dynamic = "force-dynamic";

interface Zapytanie {
  q: string;
  artistQ: string;
  titleQ: string;
  f: string;
  lubie?: string;
}

/** Zawężanie ma pierwszeństwo przed jednym polem — patrz `Wyniki`. */
function zawezone(artistQ: string, titleQ: string) {
  return artistQ.trim().length > 1 || titleQ.trim().length > 1;
}

/**
 * Ekran szukania: szkielet natychmiast, wyniki osobno.
 *
 * MusicBrainz przyjmuje jedno zapytanie na sekundę, więc odpowiedź potrafi iść
 * kilka sekund — a przez ten czas przeglądarka trzymała jedno otwarte
 * połączenie i czekała na CAŁOŚĆ strony. W pociągu wystarczył jeden tunel, żeby
 * przepadło wszystko razem z polem szukania, i wyglądało to na awarię portalu.
 *
 * Teraz nagłówek, pole szukania i zawężanie lecą do przeglądarki od razu, a
 * wyniki dopinają się drugim kawałkiem, gdy MusicBrainz odpowie. Zerwane
 * połączenie psuje wtedy najwyżej wyniki — a te ponawia przycisk przy nich,
 * bez przeładowywania całej strony.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; a?: string; t?: string; f?: string; miss?: string; lubie?: string }>;
}) {
  const { t } = await i18n();
  const { q = "", a: artistQ = "", t: titleQ = "", f = "", miss, lubie } = await searchParams;
  const narrowed = zawezone(artistQ, titleQ);

  return (
    <div>
      <h1 className="mb-4 text-4xl">{t.nav.search}</h1>
      <ScreenHelp screen="szukaj" />
      <SearchBox defaultValue={q} big placeholder={t.nav.searchPlaceholder} label={t.nav.search} />
      <form action="/szukaj" className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-xs text-muted">
          {/* "Sigh" i "Goh-Ka" to przykładowe nazwa zespołu i tytuł płyty — nazwy własne, nie tłumaczymy. */}
          <span className="label block">{t.search.artistLabel}</span>
          <input name="a" defaultValue={artistQ} placeholder="np. Sigh" className="input w-56 py-1 text-sm" autoComplete="off" />
        </label>
        <label className="text-xs text-muted">
          <span className="label block">{t.search.albumTitleLabel}</span>
          <input name="t" defaultValue={titleQ} placeholder="np. Goh-Ka" className="input w-56 py-1 text-sm" autoComplete="off" />
        </label>
        <button className="btn">{t.search.narrow}</button>
        {narrowed && <Link href="/szukaj" className="text-xs text-muted hover:text-accent2">{t.search.clear}</Link>}
      </form>
      {miss && <p className="mt-3 text-sm text-warn">{t.search.missNotice}</p>}
      {lubie && <p className="mt-3 text-sm text-muted">{t.search.likeNotice}</p>}
      {(q || narrowed) && (
        // `key` po treści zapytania: nowe szukanie ma pokazać szkielet od nowa,
        // zamiast trzymać poprzednie wyniki do czasu odpowiedzi.
        <Suspense key={`${q}|${artistQ}|${titleQ}|${f}`} fallback={<ListSkeleton note={t.search.loadingData} />}>
          <Wyniki q={q} artistQ={artistQ} titleQ={titleQ} f={f} lubie={lubie} />
        </Suspense>
      )}
    </div>
  );
}

/** Wszystko, co wymaga czekania: MusicBrainz, baza portalu, oceny. */
async function Wyniki({ q, artistQ, titleQ, f, lubie }: Zapytanie) {
  const { t } = await i18n();
  const narrowed = zawezone(artistQ, titleQ);
  const shown = narrowed ? [artistQ, titleQ].filter(Boolean).join(" — ") : q;

  // Który zakres wyników pokazujemy (i o który w ogóle pytamy).
  const showAlbums = f === "" || f === "plyty";
  const showBands = f === "" || f === "zespoly";
  const showPeople = f === "" || f === "ludzie";
  const showArtists = showBands || showPeople;
  const showMine = f === "" || f === "portal";
  const user = await currentUser();
  let albums: Awaited<ReturnType<typeof searchAlbums>> = [];
  let artists: Awaited<ReturnType<typeof searchArtists>> = [];
  let error: string | null = null;
  // Najpierw to, co portal ma u siebie — ta część działa nawet wtedy, gdy
  // MusicBrainz nie odpowiada.
  const mine = narrowed
    ? await localAlbumsBy({ artist: artistQ, title: titleQ }).catch(() => [])
    : q.trim()
      ? await localAlbums(q).catch(() => [])
      : [];
  try {
    // Zakres zmienia SAMO PYTANIE, nie tylko to, co pokazujemy: „Zespoły"
    // pyta MusicBrainz o `type:group`, „Ludzie" o `type:person`, a „Płyty"
    // w ogóle nie zawraca głowy indeksowi artystów. Dzięki temu w zawężeniu
    // mieści się więcej trafień tego jednego rodzaju, zamiast dziesięciu
    // wymieszanych.
    const kind = f === "zespoly" ? ("group" as const) : f === "ludzie" ? ("person" as const) : undefined;
    const artistTerm = narrowed ? artistQ.trim() : q;
    [albums, artists] = await Promise.all([
      !showAlbums
        ? Promise.resolve([])
        : narrowed
          ? searchAlbumsBy({ artist: artistQ, title: titleQ }, f === "plyty" ? 30 : 15)
          : searchAlbums(q, f === "plyty" ? 30 : 15),
      !showArtists || !artistTerm ? Promise.resolve([]) : searchArtists(artistTerm, kind ? 25 : 10, kind),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : t.search.searchError;
  }
  // Przez dbSafe: gdy baza ocen nie odpowie, ekran ma pokazać wyniki
  // z MusicBrainz zamiast zamienić się w „Coś poszło nie tak". Oceny są tu
  // dodatkiem, a nie treścią strony.
  const ratingsS = await dbSafe(
    ratingAverages("ALBUM", albums.map((a) => a.mbid)),
    new Map<string, { avg: number; count: number }>(),
  );
  const ratings = ratingsS.value;

  // Filtr typu wyniku — jak w odtwarzaczach: „wszystko" i zawężenia.
  // Trzyma się w adresie, więc wynik da się wysłać linkiem.
  const params = (kind: string) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (artistQ) sp.set("a", artistQ);
    if (titleQ) sp.set("t", titleQ);
    if (kind) sp.set("f", kind);
    return `/szukaj?${sp.toString()}`;
  };
  /**
   * Liczniki tylko tam, gdzie naprawdę pytaliśmy.
   *
   * Po zawężeniu do „Zespoły" nie pytamy w ogóle o płyty — a licznik pokazywał
   * wtedy „Płyty 0", czyli nieprawdę. Zero, którego nie sprawdziliśmy, jest
   * gorsze niż brak liczby.
   */
  const ile = (widoczne: boolean, n: number) => (widoczne ? n : null);
  const FILTERS: { id: string; label: string; count: number | null; href: string }[] = [
    { id: "", label: t.common.all, count: null },
    { id: "plyty", label: t.common.albums, count: ile(showAlbums, albums.length) },
    { id: "zespoly", label: t.common.bands, count: ile(showBands, artists.filter((a) => !a.isPerson).length) },
    { id: "ludzie", label: t.common.people, count: ile(showPeople, artists.filter((a) => a.isPerson).length) },
    { id: "portal", label: t.search.inPortal, count: ile(showMine, mine.length) },
    // Adres liczymy TU, na serwerze: do komponentu klienckiego wolno przesłać
    // tekst, ale nie funkcję, która go wyliczy.
  ].map((x) => ({ ...x, href: params(x.id) }));

  return (
    <>
      <FilterChips items={FILTERS} active={f} />
      {error && (
        <>
          <PartFail
            what={`${t.common.partFailSearch}${mine.length > 0 ? ` ${t.search.errorMineFallback}` : ""}`}
            retryLabel={t.common.partFailRetry}
          />
          <p className="text-xs text-faint">{error}</p>
        </>
      )}
      {/* Oceny to dodatek — gdy padną, wyniki zostają, a ponowić da się samo to. */}
      {ratingsS.failed && albums.length > 0 && (
        <PartFail what={t.common.partFailRatings} retryLabel={t.common.partFailRetry} />
      )}
      {showMine && mine.length > 0 && (
        <section className="mt-6">
          <h2 className="label mb-3">{t.search.inPortal}</h2>
          <div className="grid gap-2">
            {mine.map((h) => (
              <Link key={h.href} href={h.href} className="block rounded-lg border border-rule bg-surface2 px-3 py-2 hover:border-accent">
                <span className="display text-lg leading-tight">{h.artist} — <em>{h.album}</em></span>
                <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-muted">{h.sub}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
      <div className={`mt-8 grid gap-8 ${showAlbums && showArtists ? "md:grid-cols-[1fr_320px]" : ""}`}>
        {showAlbums && (
          <section>
            <h2 className="label mb-3">{t.common.albums}</h2>
            {albums.length ? (
              <div className="grid gap-3">
                {albums.map((a) => (
                  <AlbumCard
                    key={a.mbid}
                    album={a}
                    rating={ratings.get(a.mbid)}
                    extra={
                      lubie && user ? (
                        <form action={addLikedFromSearch} className="mt-1">
                          <input type="hidden" name="mbid" value={a.mbid} />
                          <input type="hidden" name="title" value={a.title} />
                          <input type="hidden" name="artistName" value={a.artistText} />
                          <input type="hidden" name="artistMbid" value={a.credit[0]?.mbid ?? ""} />
                          <button className="btn text-xs">{t.search.likeThisAlbum}</button>
                        </form>
                      ) : null
                    }
                  />
                ))}
              </div>
            ) : (
              <Empty>{fmt(t.search.noAlbumsFor, { name: shown })}</Empty>
            )}
          </section>
        )}
        {showArtists && (
          <section>
            <h2 className="label mb-3">
              {f === "zespoly" ? t.common.bands : f === "ludzie" ? t.common.people : t.search.artistsAndMusicians}
            </h2>
            {artists.length ? (
              <div className="grid gap-2">
                {artists.map((a) => {
                  // Sama nazwa nie wystarcza: „Cynic" to w MusicBrainz kilka
                  // zespołów. Lata, miejsce i gatunki przychodzą w tej samej
                  // odpowiedzi wyszukiwarki, więc pokazujemy je od razu.
                  const lata = a.begin || a.end ? `${a.begin?.slice(0, 4) ?? "?"}–${a.ended ? (a.end?.slice(0, 4) ?? "") : ""}` : null;
                  const skad = [a.city, a.area ?? a.country].filter(Boolean).join(", ");
                  return (
                    <ArtistCard
                      key={a.mbid}
                      mbid={a.mbid}
                      name={a.name}
                      sub={[a.isPerson ? t.search.person : a.type?.toLowerCase(), skad || null, lata].filter(Boolean).join(" · ")}
                      extra={
                        <>
                          {a.disambiguation && <div className="mt-0.5 text-xs text-text2">{a.disambiguation}</div>}
                          {a.tags.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {a.tags.map((tag) => (
                                <span key={tag} className="chip text-[10px]">{tag}</span>
                              ))}
                            </div>
                          )}
                          {a.aliases.length > 0 && (
                            <div className="mt-1 text-[10px] text-faint">{t.search.akaPrefix} {a.aliases.join(", ")}</div>
                          )}
                        </>
                      }
                    />
                  );
                })}
              </div>
            ) : (
              <Empty>{f === "zespoly" ? t.search.noBands : f === "ludzie" ? t.search.noPeople : t.search.noArtists}</Empty>
            )}
          </section>
        )}
      </div>
    </>
  );
}
