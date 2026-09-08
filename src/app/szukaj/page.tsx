import type { Metadata } from "next";
import { SearchBox } from "@/components/search-box";
import { AlbumCard, ArtistCard, Empty } from "@/components/cards";
import { searchAlbums, searchAlbumsBy, searchArtists } from "@/lib/musicbrainz";
import { ratingAverages } from "@/lib/user-data";
import { currentUser } from "@/lib/auth";
import { addLikedFromSearch } from "@/app/actions";
import { localAlbums, localAlbumsBy } from "@/lib/local-search";
import Link from "next/link";

export const metadata: Metadata = { title: "Szukaj" };
export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; a?: string; t?: string; miss?: string; lubie?: string }> }) {
  const { q = "", a: artistQ = "", t: titleQ = "", miss, lubie } = await searchParams;
  // Zawężanie ma pierwszeństwo: jak ktoś wypełnił „artysta" albo „tytuł",
  // pytamy MusicBrainz dokładnie o to pole, zamiast szukać słowa wszędzie.
  const narrowed = artistQ.trim().length > 1 || titleQ.trim().length > 1;
  const shown = narrowed ? [artistQ, titleQ].filter(Boolean).join(" — ") : q;
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
  if (narrowed || q.trim()) {
    try {
      [albums, artists] = await Promise.all([
        narrowed ? searchAlbumsBy({ artist: artistQ, title: titleQ }, 15) : searchAlbums(q, 15),
        // Przy zawężeniu lista artystów ma sens tylko dla pola „artysta".
        narrowed ? (artistQ.trim() ? searchArtists(artistQ, 10) : Promise.resolve([])) : searchArtists(q, 10),
      ]);
    } catch (e) {
      error = e instanceof Error ? e.message : "Błąd wyszukiwania";
    }
  }
  const ratings = await ratingAverages("ALBUM", albums.map((a) => a.mbid));
  return (
    <div>
      <h1 className="mb-4 text-4xl">Szukaj</h1>
      <SearchBox defaultValue={q} big />
      <form action="/szukaj" className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-xs text-muted">
          <span className="label block">Artysta</span>
          <input name="a" defaultValue={artistQ} placeholder="np. Sigh" className="input w-56 py-1 text-sm" autoComplete="off" />
        </label>
        <label className="text-xs text-muted">
          <span className="label block">Tytuł płyty</span>
          <input name="t" defaultValue={titleQ} placeholder="np. Goh-Ka" className="input w-56 py-1 text-sm" autoComplete="off" />
        </label>
        <button className="btn">Zawęź</button>
        {narrowed && <Link href="/szukaj" className="text-xs text-muted hover:text-accent2">wyczyść</Link>}
      </form>
      {miss && <p className="mt-3 text-sm text-warn">Nie udało się automatycznie dopasować tej pozycji w MusicBrainz — wybierz właściwą płytę z wyników.</p>}
      {lubie && <p className="mt-3 text-sm text-muted">Wybierz płytę, którą mam zapamiętać jako lubianą.</p>}
      {error && (
        <p className="mt-3 text-sm text-warn">
          {error}
          {mine.length > 0 && " — poniżej to, co portal ma u siebie."}
        </p>
      )}
      {mine.length > 0 && (
        <section className="mt-6">
          <h2 className="label mb-3">W portalu</h2>
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
      {(q || narrowed) && (
        <div className="mt-8 grid gap-8 md:grid-cols-[1fr_320px]">
          <section>
            <h2 className="label mb-3">Płyty</h2>
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
                          <button className="btn text-xs">♥ Lubię tę płytę</button>
                        </form>
                      ) : null
                    }
                  />
                ))}
              </div>
            ) : (
              <Empty>Brak płyt dla „{shown}”.</Empty>
            )}
          </section>
          <section>
            <h2 className="label mb-3">Artyści i muzycy</h2>
            {artists.length ? (
              <div className="grid gap-2">
                {artists.map((a) => (
                  <ArtistCard key={a.mbid} mbid={a.mbid} name={a.name} sub={[a.isPerson ? "osoba" : a.type?.toLowerCase(), a.country, a.disambiguation].filter(Boolean).join(" · ")} />
                ))}
              </div>
            ) : (
              <Empty>Brak artystów.</Empty>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
