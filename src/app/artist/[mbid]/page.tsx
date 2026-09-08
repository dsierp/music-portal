import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getArtist, getDiscography, getPlayedOn, MbError } from "@/lib/musicbrainz";
import { wikiFromLinks, wikiLogo } from "@/lib/wikipedia";
import { MbUnavailable } from "@/components/mb-unavailable";
import { currentUser } from "@/lib/auth";
import { commentTree, favoriteCount, isFavorite, ratingAverages, ratingSummary } from "@/lib/user-data";
import { toggleFavorite } from "@/app/actions";
import { LinksRow } from "@/components/links";
import { RatingBadge, RatingPanel } from "@/components/rating";
import { Comments } from "@/components/comments";
import { AlbumCard } from "@/components/cards";
import { YoutubeVideos } from "@/components/youtube";
import { relatedBands } from "@/lib/related";
import { LineupTimeline } from "@/components/lineup-timeline";
import { dbSafe } from "@/lib/db-safe";
import { DbWarning } from "@/components/db-warning";
import type { Artist, Membership, PlayedOn } from "@/lib/musicbrainz";

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
const EMPTY_SUMMARY = { avg: null, count: 0, histogram: new Array(11).fill(0) as number[], mine: null };

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

/**
 * Dyskografia + "grał(a) na płytach" — najwolniejsza część strony (MusicBrainz:
 * 1 zapytanie/s, a dla płodnych muzyków to kilka-kilkanaście zapytań). Osobny
 * komponent, żeby reszta strony (nagłówek, bio, oceny, komentarze) wyrenderowała
 * się od razu, a to doładowało się w tle pod własnym spinnerem.
 */
/**
 * Powiązane zespoły — w osobnym strumieniu, bo to kilkanaście zapytań do
 * MusicBrainz (limit 1/s). Reszta strony nie ma na nie czekać.
 */
async function RelatedSection({ artist }: { artist: Artist }) {
  const related = await relatedBands(artist).catch(() => []);
  if (!related.length) return null;
  return (
    <section className="mt-10">
      <h2 className="mb-1 text-2xl">Powiązane zespoły</h2>
      <p className="mb-3 text-xs text-muted">
        Liczone z MusicBrainz: przede wszystkim wspólni muzycy, pomocniczo wspólne gatunki. Bez zgadywania — przy każdym zespole widać, co go łączy.
      </p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {related.map((b) => (
          <li key={b.mbid} className="rounded-lg border border-rule bg-surface p-3">
            <Link href={`/artist/${b.mbid}`} className="display text-lg hover:text-accent2">{b.name}</Link>
            <p className="mt-0.5 text-xs text-text2">
              {b.people.map((p) => `${p.name}${p.roles.length ? ` (${p.roles.join(", ")})` : ""}`).join(" · ")}
            </p>
            {b.genres.length > 0 && (
              <p className="font-mono text-[10px] text-faint">wspólne: {b.genres.join(", ")}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

async function ArtistDeepContent({ artist, mbid }: { artist: Artist; mbid: string }) {
  const [disco, played] = await Promise.all([
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
  // Nie żywym czasie: skoro artysty już nie ma, nikt nie gra w zespole "obecnie".
  const deceased = artist.isPerson && artist.ended;

  return (
    <>
      {(artist.members.length > 0 || artist.memberOf.length > 0) && (
        <section className="mt-8 space-y-4">
          <h2 className="text-2xl">{artist.isPerson ? "Zespoły" : "Skład"}</h2>
          {artist.isPerson && deceased ? (
            <MemberList title="Grał w zespołach" items={artist.memberOf.filter((m) => !m.supporting)} playedByBand={playedByBand} ratings={ratings} />
          ) : (
            <>
              <MemberList
                title="Obecnie"
                items={(artist.isPerson ? artist.memberOf.filter((m) => m.current) : current).filter((m) => !m.supporting)}
                playedByBand={playedByBand}
                ratings={ratings}
              />
              <MemberList
                title="Dawniej"
                items={(artist.isPerson ? artist.memberOf.filter((m) => !m.current) : former).filter((m) => !m.supporting)}
                playedByBand={playedByBand}
                ratings={ratings}
              />
            </>
          )}
          {/* Sideman to nie członek zespołu, ale to często najważniejsze granie
              w życiorysie (Bordin u Ozzy'ego 1996–2010). MusicBrainz opisuje to
              osobną relacją, więc i my dajemy osobną listę zamiast mieszać. */}
          <MemberList
            title={artist.isPerson ? "Grał u (koncertowo / sesyjnie)" : "Muzycy towarzyszący"}
            items={(artist.isPerson ? artist.memberOf : artist.members).filter((m) => m.supporting)}
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

      {artist.workedOn.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-1 text-2xl">Produkcja, realizacja, okładki <span className="font-mono text-sm text-muted">{artist.workedOn.length}</span></h2>
          <p className="mb-3 text-xs text-muted">
            Praca przy płytach, która nie jest graniem — w MusicBrainz wisi przy wydaniu, nie przy utworze. Stąd też da się ruszyć w podróż.
          </p>
          <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {artist.workedOn.slice(0, 60).map((w) => (
              <li key={w.releaseMbid} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <Link href={`/go/mb-release/${encodeURIComponent(w.releaseMbid)}`} className="font-medium hover:text-accent2 hover:underline">
                  {w.artistText ? `${w.artistText} – ` : ""}<i>{w.title}</i>
                </Link>
                <span className="font-mono text-[10px] text-muted">{w.roles.join(", ")}</span>
                {w.date && <span className="font-mono text-[10px] text-faint">{w.date.slice(0, 4)}</span>}
              </li>
            ))}
          </ul>
          {artist.workedOn.length > 60 && (
            <p className="mt-2 text-xs text-faint">Pokazujemy 60 najnowszych z {artist.workedOn.length}.</p>
          )}
        </section>
      )}

      {!artist.isPerson && <LineupTimeline members={artist.members.filter((m) => !m.supporting)} albums={albums} />}

      <Suspense fallback={<p className="mt-10 font-mono text-xs text-muted">Szukam powiązanych zespołów…</p>}>
        <RelatedSection artist={artist} />
      </Suspense>

      <YoutubeVideos query={artist.isPerson ? artist.name : `${artist.name} band`} />
    </>
  );
}

function DeepContentLoading() {
  return (
    <div className="mt-8 flex items-center gap-3 text-sm text-muted">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-rule border-t-accent" />
      Wczytuję dyskografię i skład — przy artystach z długim dorobkiem chwilę to trwa…
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
    // 503/limit zapytań: spokojny komunikat zamiast czerwonego ekranu.
    if (e instanceof MbError) return <MbUnavailable what="artysty" />;
    throw e;
  }
  const user = await currentUser();
  // Przez dbSafe: padnięta baza ma nie zabierać treści z MusicBrainz/Wikipedii.
  const [summaryS, treeS, favS, favsS, wiki, logo] = await Promise.all([
    dbSafe(ratingSummary("ARTIST", mbid, user?.id), EMPTY_SUMMARY),
    dbSafe(commentTree("ARTIST", mbid), []),
    dbSafe(user ? isFavorite(user.id, mbid) : Promise.resolve(false), false),
    dbSafe(favoriteCount(mbid), 0),
    wikiFromLinks(artist.links).catch(() => null),
    wikiLogo(artist.links).catch(() => null),
  ]);
  const [summary, tree, fav, favs] = [summaryS.value, treeS.value, favS.value, favsS.value];
  const dbDown = summaryS.failed || treeS.failed || favS.failed || favsS.failed;

  const meta = [
    artist.isPerson ? "muzyk" : artist.type?.toLowerCase(),
    [artist.country, artist.area].filter(Boolean).join(" · "),
    artist.begin ? `${artist.begin.slice(0, 4)}${artist.ended ? `–${artist.end?.slice(0, 4) ?? ""}` : "–"}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <>
    {dbDown && <DbWarning />}
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div>
        <header className="flex gap-4">
          {wiki?.thumbnail && <img src={wiki.thumbnail} alt="" className="h-36 w-36 shrink-0 rounded object-cover" />}
          <div className="min-w-0">
            <div className="label">{meta}</div>
            {logo ? (
              // Logo zespołu (Wikidata P154) — dla metalu często nieczytelne w małym
              // rozmiarze, więc dajemy mu miejsce; nazwa zostaje dla czytników ekranu.
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={logo} alt={artist.name} className="my-1 h-auto max-h-24 w-auto max-w-full" />
            ) : (
              <h1 className="text-4xl leading-tight">{artist.name}</h1>
            )}
            {artist.disambiguation && <div className="text-sm text-muted">{artist.disambiguation}</div>}
            {artist.aliases.length > 0 && <div className="text-xs text-faint">aka {artist.aliases.join(", ")}</div>}
            {artist.genres.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {artist.genres.map((g) => <Link key={g} href={`/szukaj?q=${encodeURIComponent(g)}`} className="chip">{g}</Link>)}
              </div>
            )}
            <div className="mt-3"><LinksRow links={artist.links} wikiUrl={wiki?.url} /></div>
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

        <Suspense fallback={<DeepContentLoading />}>
          <ArtistDeepContent artist={artist} mbid={mbid} />
        </Suspense>
      </div>

      <aside className="flex flex-col gap-4">
        <RatingPanel type="ARTIST" mbid={mbid} summary={summary} loggedIn={!!user} label={artist.name} />
        <Comments type="ARTIST" mbid={mbid} tree={tree} userId={user?.id ?? null} />
        <p className="text-xs text-faint">
          <a href={`https://musicbrainz.org/artist/${mbid}`} target="_blank" rel="noopener" className="hover:text-accent2">MusicBrainz</a>
        </p>
      </aside>
    </div>
    </>
  );
}
