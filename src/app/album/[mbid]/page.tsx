import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAlbum, getArtist, getDiscography, isMusicianRole, fmtLength, MbError } from "@/lib/musicbrainz";
import { wikiAlbumRatings, wikiFromLinks, wikiPersonnel } from "@/lib/wikipedia";
import { nameKeys } from "@/lib/names";
import { MbUnavailable } from "@/components/mb-unavailable";
import { ScreenHelp } from "@/components/screen-help";
import { currentUser } from "@/lib/auth";
import { albumSentiment, commentTree, getMyLists, likeCount, listsWith, ratingAverages, ratingSummary } from "@/lib/user-data";
import { AddToList } from "@/components/add-to-list";
import { toggleFavorite, toggleLike } from "@/app/actions";
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
import { i18n } from "@/lib/t";
import { fmt, formatDate, formatNumber, plural, wikiLangs } from "@/lib/i18n";

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

export default async function AlbumPage({
  params,
  searchParams,
}: {
  params: Promise<{ mbid: string }>;
  searchParams: Promise<{ nielubie?: string }>;
}) {
  const { mbid } = await params;
  // ?nielubie=<mbid artysty> — pytanie zadane po odrzuceniu płyty. Trzymamy je
  // w adresie, bo dzięki temu przeżywa przeładowanie i nie wymaga javascriptu.
  const pytanieOArtyste = (await searchParams).nielubie ?? "";
  if (!UUID.test(mbid)) notFound();
  const { locale, t } = await i18n();
  let album;
  try {
    album = await getAlbum(mbid);
  } catch (e) {
    if (e instanceof MbError && e.status === 404) notFound();
    // 503/limit zapytań: spokojny komunikat zamiast czerwonego ekranu.
    if (e instanceof MbError) return <MbUnavailable what={t.album.mbUnavailableWhat} />;
    throw e;
  }
  const user = await currentUser();
  const mainArtist = album.credit[0];
  /**
   * Adres płyty w Spotify.
   *
   * MusicBrainz rzadko ma bezpośredni link, a wtedy `buildLinks` daje adres do
   * WYSZUKIWARKI — i tam trzeba było celować drugi raz. Gdy więc nie ma linku
   * wprost, prowadzimy przez naszą trasę: ta znajdzie płytę w chwili kliknięcia
   * (a nie przy każdym wejściu na stronę — kwota aplikacji Spotify jest mała
   * i wspólna dla całego portalu).
   */
  const linki = album.links.spotify.includes("/search/")
    ? {
        ...album.links,
        spotify: `/go/spotify?artist=${encodeURIComponent(album.artistText)}&album=${encodeURIComponent(album.title)}`,
      }
    : album.links;
  // Dane z bazy przez dbSafe: gdy lokalna baza padnie, strona ma dalej pokazać
  // to, co pochodzi z MusicBrainz/Wikipedii, a nie zamienić się w ekran błędu.
  const [summaryS, treeS, likedS, likesS, wiki, more, externalRatings, pressRatings, band] = await Promise.all([
    dbSafe(ratingSummary("ALBUM", mbid, user?.id), EMPTY_SUMMARY),
    dbSafe(commentTree("ALBUM", mbid), []),
    dbSafe(user ? albumSentiment(user.id, mbid) : Promise.resolve(null), null as "like" | "dislike" | null),
    dbSafe(likeCount(mbid), 0),
    wikiFromLinks(album.links, wikiLangs(locale)).catch(() => null),
    mainArtist ? getDiscography(mainArtist.mbid).catch(() => []) : Promise.resolve([]),
    getExternalRatings(album.links).catch(() => []),
    wikiAlbumRatings(album.links, wikiLangs(locale)).catch(() => []),
    // skład zespołu = źródło MBID-ów dla nazwisk z Wikipedii (żeby dało się w nie kliknąć)
    mainArtist ? getArtist(mainArtist.mbid).catch(() => null) : Promise.resolve(null),
  ]);
  const summary = summaryS.value;
  const tree = treeS.value;
  const liked = likedS.value;
  const likes = likesS.value;
  const others = more.filter((a) => a.mbid !== mbid && a.primaryType === "Album" && !a.secondaryTypes.length).slice(0, 8);
  const [mojeListy, naListach] = user
    ? await Promise.all([getMyLists(user.id).catch(() => []), listsWith(user.id, "ALBUM", mbid).catch(() => [])])
    : [[] as Awaited<ReturnType<typeof getMyLists>>, [] as string[]];
  const otherRatingsS = await dbSafe(ratingAverages("ALBUM", others.map((a) => a.mbid)), new Map<string, { avg: number; count: number }>());
  const otherRatings = otherRatingsS.value;
  const dbDown = summaryS.failed || treeS.failed || likedS.failed || likesS.failed || otherRatingsS.failed;
  const musicians = album.credits.filter((c) => c.roles.some(isMusicianRole));
  const staff = album.credits.filter((c) => !c.roles.some(isMusicianRole));
  // Okładka to osobna kategoria, nie „produkcja i inne": autor okładki bywa
  // powodem, dla którego sięga się po płytę, i jest pełnoprawnym węzłem podróży
  // — z jego strony widać wszystkie płyty, które oprawił.
  const COVER_ROLES = /design|illustration|art direction|graphic|photograph|artwork/i;
  const coverArtists = staff.filter((c) => c.roles.some((r) => COVER_ROLES.test(r)));
  const discs = [...new Set(album.tracks.map((tr) => tr.disc))];
  // MusicBrainz nierzadko nie ma jeszcze składu na poziomie nagrań — wtedy bierzemy
  // listę z sekcji "Skład"/"Personnel" na Wikipedii.
  const wikiCredits = !musicians.length && wiki ? await wikiPersonnel(wiki.lang, wiki.title).catch(() => null) : null;
  // Skład zespołu Z CZASU tej płyty — z dat członkostwa, czyli z tego samego
  // źródła, z którego rysuje się oś czasu na stronie zespołu.
  //
  // Po co, skoro wyżej są credits: MusicBrainz opisuje nagrania wybiórczo i przy
  // wielu płytach zna jedno nazwisko (tu: wokalistę), podczas gdy Metal-Archives
  // pokazuje pełną piątkę. Daty członkostwa MB ma komplet, więc dokładamy je jako
  // osobną, wyraźnie podpisaną listę — to nie są credits z okładki i nie udajemy,
  // że są.
  const albumDate = album.firstReleaseDate ?? null;
  const lineupThen = (() => {
    if (!band?.members?.length || !albumDate) return [];
    const inRange = band.members.filter((m) => {
      if (m.begin && m.begin > albumDate) return false;
      if (m.end && m.end < albumDate) return false;
      return Boolean(m.begin || m.end || m.current);
    });
    const already = new Set(musicians.map((c) => c.mbid));
    return inRange.filter((m) => !already.has(m.mbid));
  })();
  // …i dopasowujemy nazwiska do MBID-ów (członkowie zespołu + credits z MB), żeby
  // dało się w nie kliknąć — bez tego "podróż" po składach urywa się na tej stronie.
  const knownPeople = new Map<string, string>();
  for (const m of [...(band?.members ?? []), ...(band?.memberOf ?? [])]) {
    for (const k of nameKeys(m.name)) knownPeople.set(k, m.mbid);
  }
  for (const c of album.credits) for (const k of nameKeys(c.name)) knownPeople.set(k, c.mbid);
  const findPerson = (name: string) => nameKeys(name).map((k) => knownPeople.get(k)).find(Boolean) ?? null;

  // Kto stoi wyżej, w składzie zespołu — żeby nie pokazywać go drugi raz
  // w kredytach poniżej. Porównujemy po nazwisku, bo credits z Wikipedii
  // nie mają MBID-ów.
  const wSkladzie = new Set(lineupThen.map((m) => m.name.toLowerCase()));

  return (
    <>
    {dbDown && <DbWarning />}
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div>
        <header className="flex flex-col gap-4 sm:flex-row">
          <div className="shrink-0">
            <Cover mbid={mbid} size={176} className="shadow-lg" noCoverLabel={t.album.noCoverLabel} />
            {/* Cover Art Archive trzyma też oryginał — bywa wielki i wart obejrzenia. */}
            <a
              href={`https://coverartarchive.org/release-group/${mbid}/front`}
              target="_blank"
              rel="noopener"
              className="mt-1 block text-center font-mono text-[10px] text-faint hover:text-accent2"
            >
              {t.album.fullSizeCover}
            </a>
          </div>
          <div className="min-w-0">
            <div className="label">{typeLabel(album)}{album.year ? ` · ${album.year}` : ""}</div>
            <h1 className="text-4xl leading-tight">{album.title}</h1>
            <div className="mt-1 text-xl text-text2"><CreditLinks credit={album.credit} /></div>
            {album.disambiguation && <div className="text-sm text-muted">{album.disambiguation}</div>}
            <div className="mt-2 flex flex-wrap gap-x-3 font-mono text-xs text-muted">
              {album.releaseDate && <span>{fmt(t.album.releasedOn, { date: formatDate(album.releaseDate, locale) })}</span>}
              {album.labels.length > 0 && <span>{album.labels.join(", ")}</span>}
            </div>
            {album.genres.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {album.genres.map((g) => <Link key={g} href={`/szukaj?q=${encodeURIComponent(g)}`} className="chip">{g}</Link>)}
              </div>
            )}
            {coverArtists.length > 0 && (
              <p className="mt-2 text-sm">
                <span className="label mr-1">{t.album.coverLabel}</span>
                {coverArtists.map((c, i) => (
                  <span key={c.mbid}>
                    {i > 0 && ", "}
                    <Link href={`/artist/${c.mbid}`} className="hover:text-accent2 hover:underline">{c.name}</Link>
                    <span className="ml-1 font-mono text-[10px] text-faint">{c.roles.join(", ")}</span>
                  </span>
                ))}
              </p>
            )}
            <div className="mt-3"><LinksRow links={linki} wikiUrl={wiki?.url} /></div>
            <div className="mt-3 flex items-center gap-3">
              {user ? (
                // Dwa przyciski, nie jeden przełącznik: „lubię" i „nie moja bajka"
                // to nie są dwa końce jednej skali — większość płyt zostaje bez
                // znaku i tak ma być.
                <>
                  <form action={toggleLike}>
                    <input type="hidden" name="mbid" value={mbid} />
                    <input type="hidden" name="current" value={liked ?? ""} />
                    <input type="hidden" name="kind" value="like" />
                    <input type="hidden" name="title" value={album.title} />
                    <input type="hidden" name="artistName" value={album.artistText} />
                    <input type="hidden" name="artistMbid" value={mainArtist?.mbid ?? ""} />
                    <button className={`btn ${liked === "like" ? "btn-accent" : ""}`}>
                      {liked === "like" ? t.album.likeActive : t.album.likeAdd}
                    </button>
                  </form>
                  <form action={toggleLike}>
                    <input type="hidden" name="mbid" value={mbid} />
                    <input type="hidden" name="current" value={liked ?? ""} />
                    <input type="hidden" name="kind" value="dislike" />
                    <input type="hidden" name="title" value={album.title} />
                    <input type="hidden" name="artistName" value={album.artistText} />
                    <input type="hidden" name="artistMbid" value={mainArtist?.mbid ?? ""} />
                    <button className={`btn ${liked === "dislike" ? "btn-warn" : ""}`}>
                      {liked === "dislike" ? t.album.dislikeActive : t.album.dislikeAdd}
                    </button>
                  </form>
                </>
              ) : (
                <Link href={`/login?callbackUrl=/album/${mbid}`} className="btn">{t.album.likeAdd}</Link>
              )}
              {user && (
                <AddToList
                  type="ALBUM"
                  mbid={mbid}
                  label={`${album.artistText} – ${album.title}`}
                  lists={mojeListy}
                  already={naListach}
                  t={{
                    addTo: t.lists.addTo,
                    pick: t.lists.pickList,
                    newList: t.lists.orNewList,
                    newPlaceholder: t.lists.newListPlaceholder,
                    add: t.lists.addToSubmit,
                    onList: t.lists.onLists,
                  }}
                />
              )}
              {likes > 0 && <span className="font-mono text-xs text-muted">{plural(locale, likes, t.album.likesCount)}</span>}
            </div>
            <ScreenHelp screen="plyta" />
            {/* Odrzuciłeś płytę — pytamy o artystę, bo to zwykle „nie mój
                klimat", a nie „ta jedna płyta wyszła słabo". Pytanie znika samo
                po odpowiedzi albo po przejściu dalej. */}
            {user && pytanieOArtyste && pytanieOArtyste === (mainArtist?.mbid ?? "") && (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-rule bg-surface2 px-3 py-2 text-sm">
                <span>{fmt(t.album.dislikeArtistAsk, { name: mainArtist?.name ?? album.artistText })}</span>
                <form action={toggleFavorite}>
                  <input type="hidden" name="mbid" value={mainArtist?.mbid ?? ""} />
                  <input type="hidden" name="kind" value="dislike" />
                  <input type="hidden" name="current" value="" />
                  <input type="hidden" name="name" value={mainArtist?.name ?? album.artistText} />
                  <input type="hidden" name="back" value={`/album/${mbid}`} />
                  <button className="btn btn-warn">{t.album.dislikeArtistYes}</button>
                </form>
                <Link href={`/album/${mbid}`} className="text-xs text-muted underline">{t.album.dislikeArtistNo}</Link>
              </div>
            )}
          </div>
        </header>

        <RatingsBar mbRating={album.mbRating} press={pressRatings} external={externalRatings} links={album.links} />

        {wiki && (
          <section className="mt-6 text-sm text-text2">
            <p>{wiki.extract}</p>
            <a href={wiki.url} target="_blank" rel="noopener" className="text-xs text-muted hover:text-accent2">{fmt(t.common.wikipediaLink, { lang: wiki.lang })}</a>
          </section>
        )}

        <section className="mt-8">
          <h2 className="mb-2 text-2xl">{t.album.lineupHeading}</h2>
          {lineupThen.length > 0 && (
            <div className="mb-5">
              <h3 className="label mb-1">{t.album.currentLineupHeading}</h3>
              <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                {lineupThen.map((m) => (
                  <li key={m.mbid} className="flex items-baseline gap-2">
                    <Link href={`/artist/${m.mbid}`} className="font-medium hover:text-accent2 hover:underline">{m.name}</Link>
                    {m.roles.length > 0 && <span className="text-muted">{m.roles.join(", ")}</span>}
                    <span className="font-mono text-[10px] text-faint">
                      {m.begin?.slice(0, 4) ?? "?"}–{m.current ? "" : (m.end?.slice(0, 4) ?? "?")}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-faint">{t.album.currentLineupNote}</p>
            </div>
          )}
          {musicians.length ? (
            <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
              {musicians.map((c) => (
                <li key={c.mbid} className="flex items-baseline gap-2 text-sm">
                  <Link href={`/artist/${c.mbid}`} className="font-medium hover:text-accent2 hover:underline">{c.name}</Link>
                  <span className="text-muted">{c.roles.filter(isMusicianRole).join(", ")}</span>
                  {!c.onAllTracks && c.trackCount > 0 && <span className="font-mono text-[10px] text-faint">{c.trackCount}/{album.tracks.length} {t.album.trackCountSuffix}</span>}
                </li>
              ))}
            </ul>
          ) : wikiCredits?.length ? (
            <div>
              <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                {wikiCredits.filter((line) => !wSkladzie.has(line.name.toLowerCase())).map((line, i) => {
                  const personMbid = findPerson(line.name);
                  return (
                    <li key={i} className="flex items-baseline gap-2">
                      {personMbid ? (
                        <Link href={`/artist/${personMbid}`} className="font-medium hover:text-accent2 hover:underline">{line.name}</Link>
                      ) : (
                        // Nie znamy MBID — ale nazwisko i tak ma prowadzić dalej,
                        // więc kierujemy do wyszukiwarki portalu.
                        <Link href={`/go/mb?typ=artist&nazwa=${encodeURIComponent(line.name)}`} className="font-medium text-text2 decoration-dotted hover:text-accent2 hover:underline" title={t.album.searchInPortalTitle}>{line.name}</Link>
                      )}
                      {line.roles && <span className="text-muted">{line.roles}</span>}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-xs text-faint">
                {t.album.wikiCreditsPrefix} <a href={wiki?.url} target="_blank" rel="noopener" className="underline hover:text-accent2">Wikipedia</a>{t.album.wikiCreditsSuffix}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted">
              {t.album.noLineupPrefix} {mainArtist && <Link href={`/artist/${mainArtist.mbid}`} className="underline">{mainArtist.name}</Link>} {t.album.noLineupMembers} {album.links.metalArchives && <a href={album.links.metalArchives} className="underline" target="_blank" rel="noopener">Metal-Archives</a>}{album.links.allmusic && <a href={album.links.allmusic} className="underline" target="_blank" rel="noopener">AllMusic</a>}.
            </p>
          )}

          {staff.length > 0 && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-muted hover:text-accent2">{fmt(t.album.staffSummary, { n: formatNumber(staff.length, locale) })}</summary>
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
            <h2 className="mb-2 text-2xl">{t.album.tracksHeading}</h2>
            {discs.map((d) => (
              <ol key={d} className="mb-3 text-sm">
                {discs.length > 1 && <div className="label my-1">{fmt(t.album.discLabel, { n: d })}</div>}
                {album.tracks.filter((tr) => tr.disc === d).map((tr) => (
                  <li key={tr.recordingMbid + tr.position} className="flex gap-3 border-b border-rule/60 py-1">
                    <span className="w-6 text-right font-mono text-xs text-faint">{tr.number}</span>
                    <span className="flex-1">{tr.title}</span>
                    <span className="font-mono text-xs text-muted">{fmtLength(tr.lengthMs)}</span>
                  </li>
                ))}
              </ol>
            ))}
          </section>
        )}

        <YoutubeVideos query={`${album.artistText} ${album.title}`} />

        {others.length > 0 && mainArtist && (
          <section className="mt-8">
            <h2 className="mb-2 text-2xl">{t.album.morePrefix} <Link href={`/artist/${mainArtist.mbid}`} className="hover:text-accent2">{mainArtist.name}</Link></h2>
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
          <a href={`https://musicbrainz.org/release-group/${mbid}`} target="_blank" rel="noopener" className="hover:text-accent2">MusicBrainz</a> · {t.album.mbLinkFooterSuffix}
        </p>
      </aside>
    </div>
    </>
  );
}
