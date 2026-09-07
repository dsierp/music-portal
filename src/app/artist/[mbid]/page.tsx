import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getArtist, getDiscography, getPlayedOn, MbError } from "@/lib/musicbrainz";
import { wikiFromLinks } from "@/lib/wikipedia";
import { currentUser } from "@/lib/auth";
import { commentTree, favoriteCount, isFavorite, ratingAverages, ratingSummary } from "@/lib/user-data";
import { toggleFavorite } from "@/app/actions";
import { LinksRow } from "@/components/links";
import { RatingBadge, RatingPanel } from "@/components/rating";
import { Comments } from "@/components/comments";
import { AlbumCard } from "@/components/cards";
import { YoutubeVideos } from "@/components/youtube";
import type { Membership, PlayedOn } from "@/lib/musicbrainz";

/** Grupuje "Grał(a) na płytach" wg zespołu (do rozwijania przy pozycji w Zespoły). */
function groupByBand(played: PlayedOn[]) {
  const map = new Map<string, PlayedOn[]>();
  for (const p of played) {
    if (!p.withBand) continue;
    if (!map.has(p.withBand)) map.set(p.withBand, []);
    map.get(p.withBand)!.push(p);
  }
  return map;
}

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f-]{36}$/;

export async function generateMetadata({ params }: { params: Promise<{ mbid: string }> }): Promise<Metadata> {
  const { mbid } = await params;
  if (!UUID.test(mbid)) return {};
  try {
    return { title: (await getArtist(mbid)).name };
  } catch {
    return {};
  }
}

function MemberList({
  title,
  items,
  playedByBand,
  ratings,
}: {
  title: string;
  items: Membership[];
  playedByBand?: Map<string, PlayedOn[]>;
  ratings?: Map<string, { avg: number; count: number }>;
}) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="label mb-1">{title}</h3>
      <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
        {items.map((m, i) => {
          const albums = playedByBand?.get(m.name);
          return (
            <li key={m.mbid + i} className="text-sm">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <Link href={`/artist/${m.mbid}`} className="font-medium hover:text-accent2 hover:underline">{m.name}</Link>
                {m.roles.length > 0 && <span className="text-muted">{m.roles.join(", ")}</span>}
                {(m.begin || m.end) && <span className="font-mono text-[10px] text-faint">{m.begin?.slice(0, 4) ?? "?"}–{m.current ? "" : m.end?.slice(0, 4) ?? "?"}</span>}
              </div>
              {albums && albums.length > 0 && (
                <details className="mt-0.5">
                  <summary className="cursor-pointer text-xs text-muted hover:text-accent2">
                    płyty z {m.name} ({albums.length})
                  </summary>
                  <ul className="mt-1 space-y-0.5 border-l border-rule/60 pl-3">
                    {albums.map((p) => (
                      <li key={p.album.mbid} className="flex flex-wrap items-baseline gap-x-2">
                        <Link href={`/album/${p.album.mbid}`} className="hover:text-accent2 hover:underline">{p.album.title}</Link>
                        {p.album.year && <span className="font-mono text-[10px] text-faint">{p.album.year}</span>}
                        {p.roles.length > 0 && <span className="text-xs text-muted">{p.roles.join(", ")}</span>}
                        {ratings?.get(p.album.mbid) && (
                          <RatingBadge avg={ratings.get(p.album.mbid)!.avg} count={ratings.get(p.album.mbid)!.count} />
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default async function ArtistPage({ params }: { params: Promise<{ mbid: string }> }) {
  const { mbid } = await params;
  if (!UUID.test(mbid)) notFound();
  let artist;
  try {
    artist = await getArtist(mbid);
  } catch (e) {
    if (e instanceof MbError && e.status === 404) notFound();
    throw e;
  }
  const user = await currentUser();
  const [summary, tree, fav, favs, wiki, disco, played] = await Promise.all([
    ratingSummary("ARTIST", mbid, user?.id),
    commentTree("ARTIST", mbid),
    user ? isFavorite(user.id, mbid) : false,
    favoriteCount(mbid),
    wikiFromLinks(artist.links).catch(() => null),
    getDiscography(mbid).catch(() => []),
    artist.isPerson ? getPlayedOn(mbid, artist.memberOf).catch(() => []) : Promise.resolve([]),
  ]);
  const albums = disco.filter((a) => a.primaryType === "Album" && !a.secondaryTypes.length);
  const eps = disco.filter((a) => a.primaryType === "EP" && !a.secondaryTypes.length);
  const rest = disco.filter((a) => !albums.includes(a) && !eps.includes(a));
  const ratings = await ratingAverages("ALBUM", [...disco.map((a) => a.mbid), ...played.map((p) => p.album.mbid)]);
  const current = artist.members.filter((m) => m.current);
  const former = artist.members.filter((m) => !m.current);
  const playedByBand = artist.isPerson ? groupByBand(played) : undefined;

  const meta = [
    artist.isPerson ? "muzyk" : artist.type?.toLowerCase(),
    [artist.country, artist.area].filter(Boolean).join(" · "),
    artist.begin ? `${artist.begin.slice(0, 4)}${artist.ended ? `–${artist.end?.slice(0, 4) ?? ""}` : "–"}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div>
        <header className="flex gap-4">
          {wiki?.thumbnail && <img src={wiki.thumbnail} alt="" className="h-36 w-36 shrink-0 rounded object-cover" />}
          <div className="min-w-0">
            <div className="label">{meta}</div>
            <h1 className="text-4xl leading-tight">{artist.name}</h1>
            {artist.disambiguation && <div className="text-sm text-muted">{artist.disambiguation}</div>}
            {artist.aliases.length > 0 && <div className="text-xs text-faint">aka {artist.aliases.join(", ")}</div>}
            {artist.genres.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {artist.genres.map((g) => <Link key={g} href={`/szukaj?q=${encodeURIComponent(g)}`} className="chip">{g}</Link>)}
              </div>
            )}
            <div className="mt-3"><LinksRow links={artist.links} /></div>
            <div className="mt-3 flex items-center gap-3">
              {user ? (
                <form action={toggleFavorite}>
                  <input type="hidden" name="mbid" value={mbid} />
                  <input type="hidden" name="favorite" value={fav ? "1" : "0"} />
                  <input type="hidden" name="name" value={artist.name} />
                  <button className={`btn ${fav ? "btn-accent" : ""}`}>{fav ? "★ Ulubiony" : "☆ Do ulubionych"}</button>
                </form>
              ) : (
                <Link href={`/login?callbackUrl=/artist/${mbid}`} className="btn">☆ Do ulubionych</Link>
              )}
              {favs > 0 && <span className="font-mono text-xs text-muted">{favs} w ulubionych</span>}
            </div>
          </div>
        </header>

        {wiki && (
          <section className="mt-6 text-sm text-text2">
            <p>{wiki.extract}</p>
            <a href={wiki.url} target="_blank" rel="noopener" className="text-xs text-muted hover:text-accent2">Wikipedia ({wiki.lang}) →</a>
          </section>
        )}

        {(artist.members.length > 0 || artist.memberOf.length > 0) && (
          <section className="mt-8 space-y-4">
            <h2 className="text-2xl">{artist.isPerson ? "Zespoły" : "Skład"}</h2>
            <MemberList
              title="Obecnie"
              items={artist.isPerson ? artist.memberOf.filter((m) => m.current) : current}
              playedByBand={playedByBand}
              ratings={ratings}
            />
            <MemberList
              title="Dawniej"
              items={artist.isPerson ? artist.memberOf.filter((m) => !m.current) : former}
              playedByBand={playedByBand}
              ratings={ratings}
            />
          </section>
        )}

        {played.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-2 text-2xl">Grał(a) na płytach</h2>
            <p className="mb-3 text-xs text-muted">Wg składów w MusicBrainz — najpierw gościnnie i sesyjnie, potem z własnymi zespołami.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {played.slice(0, 40).map((p) => (
                <AlbumCard
                  key={p.album.mbid}
                  album={p.album}
                  rating={ratings.get(p.album.mbid)}
                  extra={
                    <div className="text-xs">
                      {p.roles.length > 0 && <span className="text-accent2">{p.roles.join(", ")}</span>}
                      {p.withBand ? <span className="ml-2 text-muted">z {p.withBand}</span> : <span className="ml-2 rounded bg-surface2 px-1 font-mono text-[10px] uppercase text-muted">gościnnie</span>}
                    </div>
                  }
                />
              ))}
            </div>
          </section>
        )}

        {albums.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-2 text-2xl">Albumy</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {albums.map((a) => <AlbumCard key={a.mbid} album={a} rating={ratings.get(a.mbid)} />)}
            </div>
          </section>
        )}
        {eps.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-2 text-2xl">EP</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {eps.map((a) => <AlbumCard key={a.mbid} album={a} rating={ratings.get(a.mbid)} />)}
            </div>
          </section>
        )}
        {rest.length > 0 && (
          <details className="mt-8">
            <summary className="cursor-pointer text-lg text-muted hover:text-accent2">Pozostałe wydawnictwa — single, live, kompilacje, dema ({rest.length})</summary>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {rest.map((a) => <AlbumCard key={a.mbid} album={a} rating={ratings.get(a.mbid)} />)}
            </div>
          </details>
        )}
        {!disco.length && !played.length && <p className="mt-8 text-sm text-muted">MusicBrainz nie ma wydawnictw dla tego artysty.</p>}

        <YoutubeVideos query={artist.isPerson ? artist.name : `${artist.name} band`} />
      </div>

      <aside className="flex flex-col gap-4">
        <RatingPanel type="ARTIST" mbid={mbid} summary={summary} loggedIn={!!user} label={artist.name} />
        <Comments type="ARTIST" mbid={mbid} tree={tree} userId={user?.id ?? null} />
        <p className="text-xs text-faint">
          <a href={`https://musicbrainz.org/artist/${mbid}`} target="_blank" rel="noopener" className="hover:text-accent2">MusicBrainz</a>
        </p>
      </aside>
    </div>
  );
}
