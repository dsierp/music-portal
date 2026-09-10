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

interface Pytanie {
  q: string;
  artistQ: string;
  titleQ: string;
  f: string;
}

/** Zawężanie ma pierwszeństwo przed jednym polem — patrz komentarz przy `Plyty`. */
function zawezone(artistQ: string, titleQ: string) {
  return artistQ.trim().length > 1 || titleQ.trim().length > 1;
}

/**
 * Ekran szukania: nic nie czeka na nic.
 *
 * Szukanie jest najdroższą rzeczą w portalu, bo MusicBrainz przyjmuje jedno
 * zapytanie na sekundę i przy przeciążeniu każe ponawiać. Dopóki strona
 * powstawała w całości na serwerze, czytelnik czekał na SUMĘ wszystkiego:
 * płyty + artyści + baza portalu, jedno po drugim, a zerwane połączenie
 * kasowało cały ten wysiłek. Przy słabej sieci kończyło się to pustą stroną.
 *
 * Teraz każdy kawałek leci osobno i pojawia się, gdy jest gotowy: szkielet
 * z polem szukania natychmiast, potem to, co portal ma u siebie (baza, więc
 * od razu), a płyty i artyści niezależnie od siebie. Zerwane połączenie psuje
 * najwyżej jeden kawałek — reszta zostaje, a przy tym jednym stoi przycisk
 * ponowienia.
 *
 * Liczniki przy zakresach przeniosły się do nagłówków sekcji: gdyby zostały
 * przy chipsach, wszystkie chipsy musiałyby czekać na komplet wyników — czyli
 * dokładnie na to, z czym kończymy.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; a?: string; t?: string; f?: string; miss?: string; lubie?: string }>;
}) {
  const { t } = await i18n();
  const { q = "", a: artistQ = "", t: titleQ = "", f = "", miss, lubie } = await searchParams;
  const narrowed = zawezone(artistQ, titleQ);
  const czegoSzukamy = q || narrowed;

  const showAlbums = f === "" || f === "plyty";
  const showBands = f === "" || f === "zespoly";
  const showPeople = f === "" || f === "ludzie";
  const showArtists = showBands || showPeople;
  const showMine = f === "" || f === "portal";

  // Adres liczymy TU, na serwerze: do komponentu klienckiego wolno przesłać
  // tekst, ale nie funkcję, która go wyliczy.
  const params = (kind: string) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (artistQ) sp.set("a", artistQ);
    if (titleQ) sp.set("t", titleQ);
    if (kind) sp.set("f", kind);
    return `/szukaj?${sp.toString()}`;
  };
  const FILTERS = [
    { id: "", label: t.common.all },
    { id: "plyty", label: t.common.albums },
    { id: "zespoly", label: t.common.bands },
    { id: "ludzie", label: t.common.people },
    { id: "portal", label: t.search.inPortal },
  ].map((x) => ({ ...x, count: null, href: params(x.id) }));

  const pytanie: Pytanie = { q, artistQ, titleQ, f };
  const klucz = `${q}|${artistQ}|${titleQ}|${f}`;

  return (
    <div>
      <h1 className="mb-4 text-4xl">{t.nav.search}</h1>
      <ScreenHelp screen="szukaj" />
      <SearchBox defaultValue={q} big placeholder={t.nav.searchPlaceholder} label={t.nav.search} />
      {czegoSzukamy && <FilterChips items={FILTERS} active={f} />}
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

      {czegoSzukamy && (
        <>
          {/* Baza portalu odpowiada od razu — i odpowiada nawet wtedy, gdy
              MusicBrainz milczy. Dlatego stoi wyżej niż wyniki z sieci. */}
          {showMine && (
            <Suspense key={`u-nas-${klucz}`} fallback={null}>
              <UNas {...pytanie} />
            </Suspense>
          )}
          <div className={`mt-8 grid gap-8 ${showAlbums && showArtists ? "md:grid-cols-[1fr_320px]" : ""}`}>
            {showAlbums && (
              <Suspense key={`plyty-${klucz}`} fallback={<ListSkeleton note={t.search.loadingData} />}>
                <Plyty {...pytanie} lubie={lubie} />
              </Suspense>
            )}
            {showArtists && (
              <Suspense key={`artysci-${klucz}`} fallback={<ListSkeleton note={t.search.loadingData} />}>
                <Artysci {...pytanie} />
              </Suspense>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** Trafienia w tym, co portal ma u siebie: premiery i best of. */
async function UNas({ q, artistQ, titleQ }: Pytanie) {
  const { t } = await i18n();
  const narrowed = zawezone(artistQ, titleQ);
  const mine = narrowed
    ? await localAlbumsBy({ artist: artistQ, title: titleQ }).catch(() => [])
    : q.trim()
      ? await localAlbums(q).catch(() => [])
      : [];
  if (!mine.length) return null;
  return (
    <section className="mt-6">
      <h2 className="label mb-3">
        {t.search.inPortal} <span className="font-mono text-[10px] text-muted">{mine.length}</span>
      </h2>
      <div className="grid gap-2">
        {mine.map((h) => (
          <Link key={h.href} href={h.href} className="block rounded-lg border border-rule bg-surface2 px-3 py-2 hover:border-accent">
            <span className="display text-lg leading-tight">{h.artist} — <em>{h.album}</em></span>
            <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-muted">{h.sub}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

async function Plyty({ q, artistQ, titleQ, f, lubie }: Pytanie & { lubie?: string }) {
  const { t } = await i18n();
  const narrowed = zawezone(artistQ, titleQ);
  const shown = narrowed ? [artistQ, titleQ].filter(Boolean).join(" — ") : q;
  const user = await currentUser();
  let albums: Awaited<ReturnType<typeof searchAlbums>> = [];
  let error: string | null = null;
  try {
    // Zawężanie pyta MusicBrainz osobno o pole artysty i osobno o tytuł —
    // „Sigh" w jednym polu zwraca wszystko, w czym to słowo się pojawia.
    albums = narrowed
      ? await searchAlbumsBy({ artist: artistQ, title: titleQ }, f === "plyty" ? 30 : 15)
      : await searchAlbums(q, f === "plyty" ? 30 : 15);
  } catch (e) {
    error = e instanceof Error ? e.message : t.search.searchError;
  }
  // Przez dbSafe: gdy baza ocen nie odpowie, mają zostać same wyniki.
  const ratingsS = await dbSafe(
    ratingAverages("ALBUM", albums.map((a) => a.mbid)),
    new Map<string, { avg: number; count: number }>(),
  );
  const ratings = ratingsS.value;

  return (
    <section>
      <h2 className="label mb-3">
        {t.common.albums} {albums.length > 0 && <span className="font-mono text-[10px] text-muted">{albums.length}</span>}
      </h2>
      {error ? (
        <>
          <PartFail what={t.common.partFailSearch} retryLabel={t.common.partFailRetry} />
          <p className="text-xs text-faint">{error}</p>
        </>
      ) : albums.length ? (
        <>
          {ratingsS.failed && <PartFail what={t.common.partFailRatings} retryLabel={t.common.partFailRetry} />}
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
        </>
      ) : (
        <Empty>{fmt(t.search.noAlbumsFor, { name: shown })}</Empty>
      )}
    </section>
  );
}

async function Artysci({ q, artistQ, titleQ, f }: Pytanie) {
  const { t } = await i18n();
  const narrowed = zawezone(artistQ, titleQ);
  const artistTerm = narrowed ? artistQ.trim() : q;
  let artists: Awaited<ReturnType<typeof searchArtists>> = [];
  let error: string | null = null;
  try {
    // Zakres zmienia SAMO PYTANIE: „Zespoły" pyta o `type:group`, „Ludzie"
    // o `type:person`. Dzięki temu w zawężeniu mieści się więcej trafień tego
    // jednego rodzaju, zamiast dziesięciu wymieszanych.
    const kind = f === "zespoly" ? ("group" as const) : f === "ludzie" ? ("person" as const) : undefined;
    if (artistTerm) artists = await searchArtists(artistTerm, kind ? 25 : 10, kind);
  } catch (e) {
    error = e instanceof Error ? e.message : t.search.searchError;
  }

  return (
    <section>
      <h2 className="label mb-3">
        {f === "zespoly" ? t.common.bands : f === "ludzie" ? t.common.people : t.search.artistsAndMusicians}{" "}
        {artists.length > 0 && <span className="font-mono text-[10px] text-muted">{artists.length}</span>}
      </h2>
      {error ? (
        <>
          <PartFail what={t.common.partFailSearch} retryLabel={t.common.partFailRetry} />
          <p className="text-xs text-faint">{error}</p>
        </>
      ) : artists.length ? (
        <div className="grid gap-2">
          {artists.map((a) => {
            // Sama nazwa nie wystarcza: „Cynic" to w MusicBrainz kilka zespołów.
            // Lata, miejsce i gatunki przychodzą w tej samej odpowiedzi
            // wyszukiwarki, więc pokazujemy je od razu.
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
  );
}
