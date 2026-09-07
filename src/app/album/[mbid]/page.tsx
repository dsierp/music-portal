import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAlbum, getArtist, getDiscography, isMusicianRole, fmtLength, MbError } from "@/lib/musicbrainz";
import { wikiAlbumRatings, wikiFromLinks, wikiPersonnel } from "@/lib/wikipedia";
import { nameKeys } from "@/lib/names";
import { currentUser } from "@/lib/auth";
import { commentTree, isLiked, likeCount, ratingAverages, ratingSummary } from "@/lib/user-data";
import { toggleLike } from "@/app/actions";
import { LinksRow, ReviewLinks } from "@/components/links";
import { getExternalRatings } from "@/lib/externalRatings";
import { dbSafe } from "@/lib/db-safe";
import { DbWarning } from "@/components/db-warning";
import { RatingsBar } from "@/components/ratings-bar";
import { RatingPanel } from "@/components/rating";
import { Comments } from "@/components/comments";
import { AlbumCard, CreditLinks, typeLabel } from "@/components/cards";
import { Cover } from "@/components/cover";
import { YoutubeVideos } from "@/components/youtube";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f-]{36}$/;
const EMPTY_SUMMARY = { avg: null, count: 0, histogram: new Array(11).fill(0) as number[], mine: null };

export async function generateMetadata({ params }: { params: Promise<{ mbid: string }> }): Promise<Metadata> {
  const { mbid } = await params;
  if (!UUID.test(mbid)) return {};
  try {
    const a = await getAlbum(mbid);
    return { title: `${a.artistText} – ${a.title}` };
  } catch {
    return {};
  }
}

export default async function AlbumPage({ params }: { params: Promise<{ mbid: string }> }) {
  const { mbid } = await params;
  if (!UUID.test(mbid)) notFound();
  let album;
  try {
    album = await getAlbum(mbid);
  } catch (e) {
    if (e instanceof MbError && e.status === 404) notFound();
    throw e;
  }
  const user = await currentUser();
  const mainArtist = album.credit[0];
  // Dane z bazy przez dbSafe: gdy lokalna baza padnie, strona ma dalej pokazać
  // to, co pochodzi z MusicBrainz/Wikipedii, a nie zamienić się w ekran błędu.
  const [summaryS, treeS, likedS, likesS, wiki, more, externalRatings, pressRatings, band] = await Promise.all([
    dbSafe(ratingSummary("ALBUM", mbid, user?.id), EMPTY_SUMMARY),
    dbSafe(commentTree("ALBUM", mbid), []),
    dbSafe(user ? isLiked(user.id, mbid) : Promise.resolve(false), false),
    dbSafe(likeCount(mbid), 0),
    wikiFromLinks(album.links).catch(() => null),
    mainArtist ? getDiscography(mainArtist.mbid).catch(() => []) : Promise.resolve([]),
    getExternalRatings(album.links).catch(() => []),
    wikiAlbumRatings(album.links).catch(() => []),
    // skład zespołu = źródło MBID-ów dla nazwisk z Wikipedii (żeby dało się w nie kliknąć)
    mainArtist ? getArtist(mainArtist.mbid).catch(() => null) : Promise.resolve(null),
  ]);
  const summary = summaryS.value;
  const tree = treeS.value;
  const liked = likedS.value;
  const likes = likesS.value;
  const others = more.filter((a) => a.mbid !== mbid && a.primaryType === "Album" && !a.secondaryTypes.length).slice(0, 8);
  const otherRatingsS = await dbSafe(ratingAverages("ALBUM", others.map((a) => a.mbid)), new Map<string, { avg: number; count: number }>());
  const otherRatings = otherRatingsS.value;
  const dbDown = summaryS.failed || treeS.failed || likedS.failed || likesS.failed || otherRatingsS.failed;
  const musicians = album.credits.filter((c) => c.roles.some(isMusicianRole));
  const staff = album.credits.filter((c) => !c.roles.some(isMusicianRole));
  const discs = [...new Set(album.tracks.map((t) => t.disc))];
  // MusicBrainz nierzadko nie ma jeszcze składu na poziomie nagrań — wtedy bierzemy
  // listę z sekcji "Skład"/"Personnel" na Wikipedii.
  const wikiCredits = !musicians.length && wiki ? await wikiPersonnel(wiki.lang, wiki.title).catch(() => null) : null;
  // …i dopasowujemy nazwiska do MBID-ów (członkowie zespołu + credits z MB), żeby
  // dało się w nie kliknąć — bez tego "podróż" po składach urywa się na tej stronie.
  const knownPeople = new Map<string, string>();
  for (const m of [...(band?.members ?? []), ...(band?.memberOf ?? [])]) {
    for (const k of nameKeys(m.name)) knownPeople.set(k, m.mbid);
  }
  for (const c of album.credits) for (const k of nameKeys(c.name)) knownPeople.set(k, c.mbid);
  const findPerson = (name: string) => nameKeys(name).map((k) => knownPeople.get(k)).find(Boolean) ?? null;

  return (
    <>
    {dbDown && <DbWarning />}
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div>
        <header className="flex flex-col gap-4 sm:flex-row">
          <Cover mbid={mbid} size={176} className="shadow-lg" />
          <div className="min-w-0">
            <div className="label">{typeLabel(album)}{album.year ? ` · ${album.year}` : ""}</div>
            <h1 className="text-4xl leading-tight">{album.title}</h1>
            <div className="mt-1 text-xl text-text2"><CreditLinks credit={album.credit} /></div>
            {album.disambiguation && <div className="text-sm text-muted">{album.disambiguation}</div>}
            <div className="mt-2 flex flex-wrap gap-x-3 font-mono text-xs text-muted">
              {album.releaseDate && <span>wydano {album.releaseDate}</span>}
              {album.labels.length > 0 && <span>{album.labels.join(", ")}</span>}
            </div>
            {album.genres.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {album.genres.map((g) => <Link key={g} href={`/szukaj?q=${encodeURIComponent(g)}`} className="chip">{g}</Link>)}
              </div>
            )}
            <div className="mt-3"><LinksRow links={album.links} /></div>
            <div className="mt-3 flex items-center gap-3">
              {user ? (
                <form action={toggleLike}>
                  <input type="hidden" name="mbid" value={mbid} />
                  <input type="hidden" name="liked" value={liked ? "1" : "0"} />
                  <input type="hidden" name="title" value={album.title} />
                  <input type="hidden" name="artistName" value={album.artistText} />
                  <input type="hidden" name="artistMbid" value={mainArtist?.mbid ?? ""} />
                  <button className={`btn ${liked ? "btn-accent" : ""}`}>{liked ? "♥ Lubisz" : "♡ Lubię tę płytę"}</button>
                </form>
              ) : (
                <Link href={`/login?callbackUrl=/album/${mbid}`} className="btn">♡ Lubię tę płytę</Link>
              )}
              {likes > 0 && <span className="font-mono text-xs text-muted">{likes} {likes === 1 ? "osoba lubi" : "osób lubi"}</span>}
            </div>
          </div>
        </header>

        <RatingsBar mbRating={album.mbRating} press={pressRatings} external={externalRatings} links={album.links} />

        {wiki && (
          <section className="mt-6 text-sm text-text2">
            <p>{wiki.extract}</p>
            <a href={wiki.url} target="_blank" rel="noopener" className="text-xs text-muted hover:text-accent2">Wikipedia ({wiki.lang}) →</a>
          </section>
        )}

        <section className="mt-8">
          <h2 className="mb-2 text-2xl">Skład</h2>
          {musicians.length ? (
            <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
              {musicians.map((c) => (
                <li key={c.mbid} className="flex items-baseline gap-2 text-sm">
                  <Link href={`/artist/${c.mbid}`} className="font-medium hover:text-accent2 hover:underline">{c.name}</Link>
                  <span className="text-muted">{c.roles.filter(isMusicianRole).join(", ")}</span>
                  {!c.onAllTracks && c.trackCount > 0 && <span className="font-mono text-[10px] text-faint">{c.trackCount}/{album.tracks.length} utw.</span>}
                </li>
              ))}
            </ul>
          ) : wikiCredits?.length ? (
            <div>
              <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                {wikiCredits.map((line, i) => {
                  const personMbid = findPerson(line.name);
                  return (
                    <li key={i} className="flex items-baseline gap-2">
                      {personMbid ? (
                        <Link href={`/artist/${personMbid}`} className="font-medium hover:text-accent2 hover:underline">{line.name}</Link>
                      ) : (
                        // Nie znamy MBID — ale nazwisko i tak ma prowadzić dalej,
                        // więc kierujemy do wyszukiwarki portalu.
                        <Link href={`/szukaj?q=${encodeURIComponent(line.name)}`} className="font-medium text-text2 decoration-dotted hover:text-accent2 hover:underline" title="Szukaj w portalu">{line.name}</Link>
                      )}
                      {line.roles && <span className="text-muted">{line.roles}</span>}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-xs text-faint">
                Źródło: <a href={wiki?.url} target="_blank" rel="noopener" className="underline hover:text-accent2">Wikipedia</a> — MusicBrainz nie ma jeszcze tego składu na poziomie nagrań. Nazwiska rozpoznane w MusicBrainz prowadzą do profilu; pozostałe (kropkowane) do wyszukiwarki portalu.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted">
              MusicBrainz nie ma jeszcze składu tej płyty. Zajrzyj do zespołu {mainArtist && <Link href={`/artist/${mainArtist.mbid}`} className="underline">{mainArtist.name}</Link>} (członkowie) albo {album.links.metalArchives && <a href={album.links.metalArchives} className="underline" target="_blank" rel="noopener">Metal-Archives</a>}{album.links.allmusic && <a href={album.links.allmusic} className="underline" target="_blank" rel="noopener">AllMusic</a>}.
            </p>
          )}
          {staff.length > 0 && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-muted hover:text-accent2">Produkcja, realizacja, grafika ({staff.length})</summary>
              <ul className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                {staff.map((c) => (
                  <li key={c.mbid} className="flex items-baseline gap-2">
                    <Link href={`/artist/${c.mbid}`} className="hover:text-accent2 hover:underline">{c.name}</Link>
                    <span className="text-muted">{c.roles.join(", ")}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>

        {album.tracks.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-2 text-2xl">Utwory</h2>
            {discs.map((d) => (
              <ol key={d} className="mb-3 text-sm">
                {discs.length > 1 && <div className="label my-1">Dysk {d}</div>}
                {album.tracks.filter((t) => t.disc === d).map((t) => (
                  <li key={t.recordingMbid + t.position} className="flex gap-3 border-b border-rule/60 py-1">
                    <span className="w-6 text-right font-mono text-xs text-faint">{t.number}</span>
                    <span className="flex-1">{t.title}</span>
                    <span className="font-mono text-xs text-muted">{fmtLength(t.lengthMs)}</span>
                  </li>
                ))}
              </ol>
            ))}
          </section>
        )}

        <YoutubeVideos query={`${album.artistText} ${album.title}`} />

        {others.length > 0 && mainArtist && (
          <section className="mt-8">
            <h2 className="mb-2 text-2xl">Więcej: <Link href={`/artist/${mainArtist.mbid}`} className="hover:text-accent2">{mainArtist.name}</Link></h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {others.map((a) => <AlbumCard key={a.mbid} album={a} rating={otherRatings.get(a.mbid)} />)}
            </div>
          </section>
        )}
      </div>

      <aside className="flex flex-col gap-4">
        <RatingPanel type="ALBUM" mbid={mbid} summary={summary} loggedIn={!!user} label={`${album.artistText} – ${album.title}`} />
        <div className="card p-4">
          <ReviewLinks links={album.links} ratings={externalRatings} />
        </div>
        <Comments type="ALBUM" mbid={mbid} tree={tree} userId={user?.id ?? null} />
        <p className="text-xs text-faint">
          <a href={`https://musicbrainz.org/release-group/${mbid}`} target="_blank" rel="noopener" className="hover:text-accent2">MusicBrainz</a> · brakuje składu? Uzupełnij go tam — portal zaciągnie zmiany w ciągu tygodnia.
        </p>
      </aside>
    </div>
    </>
  );
}
