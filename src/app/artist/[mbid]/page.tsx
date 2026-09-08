import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ARTWORK_ROLES, albumCrew, getArtist, getDiscography, getPlayedOn, getProduced, guessRoles, topAlbum, MbError } from "@/lib/musicbrainz";
import { wikiFromLinks, wikiLogo } from "@/lib/wikipedia";
import { MbUnavailable } from "@/components/mb-unavailable";
import { currentUser } from "@/lib/auth";
import { artistSentiment, commentTree, favoriteCount, getMyLists, listsWith, ratingAverages, ratingSummary } from "@/lib/user-data";
import { AddToList } from "@/components/add-to-list";
import { toggleFavorite } from "@/app/actions";
import { LinksRow } from "@/components/links";
import { RatingBadge, RatingPanel } from "@/components/rating";
import { Comments } from "@/components/comments";
import { AlbumCard } from "@/components/cards";
import { YoutubeVideos } from "@/components/youtube";
import { relatedBands } from "@/lib/related";
import { concertsByArtist } from "@/lib/concerts";
import { mergeDates, wdGenres, wdMembers, wdMemberships } from "@/lib/wikidata";
import { CareerTimeline, LineupTimeline } from "@/components/lineup-timeline";
import { dbSafe } from "@/lib/db-safe";
import { DbWarning } from "@/components/db-warning";
import { i18n } from "@/lib/t";
import { fmt, formatDate, wikiLangs, type Locale } from "@/lib/i18n";
import type { Dict } from "@/lib/dict";
import type { AlbumSummary, Artist, Membership, PlayedOn } from "@/lib/musicbrainz";

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
  t,
  guessed,
}: {
  title: string;
  items: Membership[];
  playedByBand?: Map<string, PlayedOn[]>;
  ratings?: Map<string, { avg: number; count: number }>;
  t: Dict;
  /** instrumenty dobrane z innych zespołów — pokazujemy je ze znakiem zapytania */
  guessed?: Map<string, string[]>;
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
                {m.roles.length > 0 ? (
                  <span className="text-muted">{m.roles.join(", ")}</span>
                ) : (
                  guessed?.get(m.mbid) && (
                    <span className="text-faint italic" title={t.artist.roleGuessNote}>
                      {guessed.get(m.mbid)!.join(", ")}?
                    </span>
                  )
                )}
                {(m.begin || m.end) && <span className="font-mono text-[10px] text-faint">{m.begin?.slice(0, 4) ?? "?"}–{m.current ? "" : m.end?.slice(0, 4) ?? "?"}</span>}
              </div>
              {albums && albums.length > 0 && (
                <details className="mt-0.5">
                  <summary className="cursor-pointer text-xs text-muted hover:text-accent2">
                    {fmt(t.artist.albumsWithMember, { name: m.name, n: albums.length })}
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
async function RelatedSection({ artist, t }: { artist: Artist; t: Dict }) {
  const related = await relatedBands(artist).catch(() => []);
  if (!related.length) return null;
  return (
    <section className="mt-10">
      <h2 className="mb-1 text-2xl">{t.artist.relatedHeading}</h2>
      <p className="mb-3 text-xs text-muted">{t.artist.relatedNote}</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {related.map((b) => (
          <li key={b.mbid} className="rounded-lg border border-rule bg-surface p-3">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <Link href={`/artist/${b.mbid}`} className="display text-lg hover:text-accent2">{b.name}</Link>
              {/* Wizytówka: skąd i kiedy. Bez tego karta mówiła tylko „ten sam
                  basista", a to za mało, żeby wiedzieć, w co kliknąć. */}
              {(b.begin || b.end) && (
                <span className="font-mono text-[10px] text-faint">
                  {b.begin?.slice(0, 4) ?? "?"}–{b.ended ? (b.end?.slice(0, 4) ?? "?") : ""}
                </span>
              )}
              {(b.country || b.area) && <span className="font-mono text-[10px] text-faint">{b.country ?? b.area}</span>}
            </div>
            {b.disambiguation && <p className="text-[11px] text-muted">{b.disambiguation}</p>}
            {b.ownGenres.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {b.ownGenres.map((g) => (
                  <span key={g} className={`chip text-[10px] ${b.genres.includes(g) ? "chip-on" : ""}`}>{g}</span>
                ))}
              </div>
            )}
            <p className="mt-1 text-xs text-text2">
              {b.people.map((p) => `${p.name}${p.roles.length ? ` (${p.roles.join(", ")})` : ""}`).join(" · ")}
            </p>
            {b.genres.length > 0 && (
              <p className="font-mono text-[10px] text-faint">{fmt(t.artist.relatedShared, { genres: b.genres.join(", ") })}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Kto to nagrywał — producenci, realizatorzy, mastering, okładki.
 *
 * Osobny strumień, bo to jedno zapytanie do MusicBrainz na płytę (limit 1/s).
 * Świadomie ograniczone do kilku albumów: chodzi o rozpoznanie „ich" ekipy,
 * a nie o kompletny spis techniczny.
 */
async function CrewSection({ albums, t }: { albums: AlbumSummary[]; t: Dict }) {
  if (!albums.length) return null;
  const crew = await albumCrew(albums).catch(() => []);
  if (!crew.length) {
    return (
      <section className="mt-10">
        <h2 className="mb-1 text-2xl">{t.artist.crewHeading}</h2>
        <p className="text-xs text-muted">{t.artist.crewEmpty}</p>
      </section>
    );
  }
  const okladki = crew.filter((c) => c.roles.some((r) => ARTWORK_ROLES.test(r)));
  const studio = crew.filter((c) => !okladki.includes(c));
  const Lista = ({ title, items }: { title: string; items: typeof crew }) =>
    items.length ? (
      <div>
        <h3 className="label mb-1">{title}</h3>
        <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {items.map((c) => (
            <li key={c.mbid} className="text-sm">
              <Link href={`/artist/${c.mbid}`} className="font-medium hover:text-accent2 hover:underline">{c.name}</Link>{" "}
              <span className="text-muted">{c.roles.join(", ")}</span>{" "}
              <span className="font-mono text-[10px] text-faint" title={c.albums.map((a) => a.title).join(" · ")}>
                {fmt(t.artist.crewOnAlbums, { n: c.albums.length })}
              </span>
            </li>
          ))}
        </ul>
      </div>
    ) : null;
  return (
    <section className="mt-10 space-y-4">
      <div>
        <h2 className="mb-1 text-2xl">{t.artist.crewHeading}</h2>
        <p className="text-xs text-muted">{t.artist.crewNote}</p>
      </div>
      <Lista title={t.artist.crewStudio} items={studio} />
      <Lista title={t.artist.crewArtwork} items={okladki} />
    </section>
  );
}

/**
 * Czy i gdzie ten zespół gra — z zapowiedzi MusicBrainz.
 *
 * W osobnym strumieniu i domyślnie zwinięte: to kolejne zapytanie (limit 1/s),
 * a przy większości artystów zapowiedzi po prostu nie ma. MusicBrainz jest
 * katalogiem nagrań, nie afiszem — więc gdy milczy, mówimy to wprost zamiast
 * udawać, że zespół nie koncertuje.
 */
async function ConcertsSection({ mbid, name, locale, t }: { mbid: string; name: string; locale: Locale; t: Dict }) {
  const items = await concertsByArtist({ mbid, name }).catch(() => []);
  return (
    <details className="mt-10">
      <summary className="cursor-pointer text-2xl text-muted hover:text-accent2">
        {t.artist.concertsHeading}
        {items.length > 0 && <span className="ml-2 font-mono text-sm text-accent2">{items.length}</span>}
      </summary>
      {items.length ? (
        <ul className="mt-3 space-y-2">
          {items.map((c) => (
            <li key={c.id} className="rounded-lg border border-rule bg-surface2 px-3 py-2">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-mono text-xs text-accent2">
                  {formatDate(c.date, locale, { year: true })}
                  {c.time ? `, ${c.time.slice(0, 5)}` : ""}
                </span>
                {c.url ? (
                  <a href={c.url} target="_blank" rel="noopener" className="display text-lg leading-tight hover:text-accent2 hover:underline">{c.name}</a>
                ) : (
                  <span className="display text-lg leading-tight">{c.name}</span>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-xs text-muted">
                {c.venue && <span>{c.venue}</span>}
                {c.city && <span>· {c.city}{c.country ? `, ${c.country}` : ""}</span>}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted">{t.artist.concertsNone}</p>
      )}
      <p className="mt-2 text-[10px] text-faint">
        {t.artist.concertsNote} <Link href="/koncerty" className="underline">{t.artist.concertsMine}</Link>
      </p>
    </details>
  );
}

async function ArtistDeepContent({ artist: raw, mbid, locale, t, odNajnowszych }: { artist: Artist; mbid: string; locale: Locale; t: Dict; odNajnowszych: boolean }) {
  // MusicBrainz nagminnie gubi daty przy członkostwie (Inferno w Behemocie od
  // 1997 — relacja jest, dat nie ma). Wikidane trzymają to samo strukturalnie,
  // więc zanim cokolwiek narysujemy, łatamy dziury stamtąd. Pytamy tylko wtedy,
  // gdy naprawdę czegoś brakuje — jedna baza jako źródło jest mniej myląca.
  const braki = (m: Membership[]) => m.some((x) => !x.begin || (!x.end && !x.current));
  const [wdOf, wdIn] = await Promise.all([
    braki(raw.memberOf) ? wdMemberships(raw.links).catch(() => []) : Promise.resolve([]),
    braki(raw.members) ? wdMembers(raw.links).catch(() => []) : Promise.resolve([]),
  ]);
  const artist: Artist = {
    ...raw,
    memberOf: mergeDates(raw.memberOf, wdOf),
    members: mergeDates(raw.members, wdIn),
  };
  const [disco, played, produced] = await Promise.all([
    getDiscography(mbid).catch(() => []),
    artist.isPerson ? getPlayedOn(mbid, artist.memberOf).catch(() => []) : Promise.resolve([]),
    // Producent nie ma dyskografii jako wykonawca — Scott Burns wyprodukował
    // pół kanonu death metalu, a jego strona świeciła „brak wydawnictw".
    artist.isPerson ? getProduced(mbid).catch(() => []) : Promise.resolve([]),
  ]);
  const albums = disco.filter((a) => a.primaryType === "Album" && !a.secondaryTypes.length);
  const eps = disco.filter((a) => a.primaryType === "EP" && !a.secondaryTypes.length);
  const rest = disco.filter((a) => !albums.includes(a) && !eps.includes(a));
  const ratings = await ratingAverages("ALBUM", [
    ...disco.map((a) => a.mbid),
    ...played.map((p) => p.album.mbid),
    ...produced.map((p) => p.album.mbid),
  ]);
  const current = artist.members.filter((m) => m.current);
  const former = artist.members.filter((m) => !m.current);
  const playedByBand = artist.isPerson ? groupByBand(played) : undefined;
  // Płyty pod oś czasu muzyka. NIE z „Grał(a) na płytach": to relacje przy
  // nagraniach, a MusicBrainz ma je tylko dla części zespołów (dla Atheist —
  // wcale). Bierzemy więc dyskografie samych zespołów, dokładnie tak jak
  // w widoku zespołu, i nanosimy je na pasek danego zespołu.
  const bandAlbums = new Map<string, typeof albums>();
  if (artist.isPerson) {
    const bands = [...new Map(artist.memberOf.map((m) => [m.mbid, m])).values()].slice(0, 10);
    const discos = await Promise.all(bands.map((b) => getDiscography(b.mbid).catch(() => [])));
    bands.forEach((b, i) => {
      bandAlbums.set(b.mbid, discos[i].filter((a) => a.primaryType === "Album" && !a.secondaryTypes.length));
    });
  }
  // Kolejność płyt: najpierw wskazujemy „tę jedną", potem cały dorobek
  // kolejnością wydania — od debiutu, bo tak się czyta drogę zespołu.
  const chronologicznie = odNajnowszych ? albums : [...albums].reverse();
  const top = topAlbum(albums, ratings);
  // Nie żywym czasie: skoro artysty już nie ma, nikt nie gra w zespole "obecnie".
  const deceased = artist.isPerson && artist.ended;
  /**
   * Ludzie, którzy grali U NIEGO — czyli jego zespół, mimo że szyld jest
   * nazwiskiem. Ozzy Osbourne to persona ORAZ zespół: pod własnym nazwiskiem
   * wydał kilkanaście płyt z konkretnymi składami (Randy Rhoads, Zakk Wylde,
   * Bordin na bębnach). Dotąd te relacje leżały na stronie osoby nieużyte i
   * skład Ozzy'ego po prostu nie istniał.
   */
  const ownBand = artist.isPerson ? artist.members : [];
  /**
   * Instrument bywa w MusicBrainz pusty (to atrybut relacji, nie pole osoby).
   * Dobieramy go wtedy z innych zespołów tego człowieka i podpisujemy „?" —
   * bębniarz może akurat tutaj grać na harfie.
   */
  const bezInstrumentu = artist.members.filter((m) => !m.roles.length).map((m) => m.mbid);
  const zgadywane = bezInstrumentu.length ? await guessRoles(bezInstrumentu, mbid).catch(() => new Map<string, string[]>()) : new Map<string, string[]>();

  return (
    <>
      {(artist.members.length > 0 || artist.memberOf.length > 0) && (
        <section className="mt-8 space-y-4">
          <h2 className="text-2xl">{artist.isPerson ? t.artist.bandsHeading : t.artist.lineupHeading}</h2>
          {artist.isPerson && deceased ? (
            <MemberList title={t.artist.playedInBands} items={artist.memberOf.filter((m) => !m.supporting)} playedByBand={playedByBand} ratings={ratings} t={t} />
          ) : (
            <>
              <MemberList
                title={t.artist.currently}
                items={(artist.isPerson ? artist.memberOf.filter((m) => m.current) : current).filter((m) => !m.supporting)}
                playedByBand={playedByBand}
                ratings={ratings}
                t={t}
                guessed={zgadywane}
              />
              <MemberList
                title={t.artist.formerly}
                items={(artist.isPerson ? artist.memberOf.filter((m) => !m.current) : former).filter((m) => !m.supporting)}
                playedByBand={playedByBand}
                ratings={ratings}
                t={t}
                guessed={zgadywane}
              />
            </>
          )}
          {/* Sideman to nie członek zespołu, ale to często najważniejsze granie
              w życiorysie (Bordin u Ozzy'ego 1996–2010). MusicBrainz opisuje to
              osobną relacją, więc i my dajemy osobną listę zamiast mieszać. */}
          <MemberList
            title={artist.isPerson ? t.artist.guestOf : t.artist.supportMusicians}
            items={(artist.isPerson ? artist.memberOf : artist.members).filter((m) => m.supporting)}
            playedByBand={playedByBand}
            ratings={ratings}
            t={t}
          />
        </section>
      )}

      {/* Skład solisty. Osobna sekcja, nie dopisek do „Zespoły": to nie są
          miejsca, w których grał on, tylko ludzie, którzy grali u niego. */}
      {artist.isPerson && ownBand.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-1 text-2xl">{t.artist.ownBandHeading}</h2>
          <p className="mb-3 text-xs text-muted">{t.artist.ownBandNote}</p>
          <div className="space-y-4">
            <MemberList title={t.artist.currently} items={ownBand.filter((m) => m.current)} ratings={ratings} t={t} />
            <MemberList title={t.artist.formerly} items={ownBand.filter((m) => !m.current)} ratings={ratings} t={t} />
          </div>
        </section>
      )}

      {produced.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-1 text-2xl">
            {t.artist.producedHeading} <span className="font-mono text-sm text-muted">{produced.length}</span>
          </h2>
          <p className="mb-3 text-xs text-muted">{t.artist.producedNote}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {produced.slice(0, 60).map((p) => (
              <AlbumCard
                key={p.album.mbid}
                album={p.album}
                rating={ratings.get(p.album.mbid)}
                extra={<div className="text-xs text-accent2">{p.roles.join(", ")}</div>}
              />
            ))}
          </div>
          {produced.length > 60 && <p className="mt-2 text-xs text-faint">{fmt(t.artist.producedMore, { n: produced.length })}</p>}
        </section>
      )}

      {played.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-2xl">{t.artist.playedOnHeading}</h2>
          <p className="mb-3 text-xs text-muted">{t.artist.playedOnNote}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {played.slice(0, 40).map((p) => (
              <AlbumCard
                key={p.album.mbid}
                album={p.album}
                rating={ratings.get(p.album.mbid)}
                extra={
                  <div className="text-xs">
                    {p.roles.length > 0 && <span className="text-accent2">{p.roles.join(", ")}</span>}
                    {p.withBand ? <span className="ml-2 text-muted">{fmt(t.artist.withBand, { name: p.withBand })}</span> : <span className="ml-2 rounded bg-surface2 px-1 font-mono text-[10px] uppercase text-muted">{t.artist.guestBadge}</span>}
                  </div>
                }
              />
            ))}
          </div>
        </section>
      )}

      {albums.length > 0 && (
        <section className="mt-8">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-2xl">{t.artist.albumsHeading}</h2>
            {/* Domyślnie kolejnością wydania — dorobek czyta się od początku.
                Jedno kliknięcie odwraca, gdy chodzi o „co nowego". */}
            <div className="flex gap-1">
              <Link href={`/artist/${mbid}`} className={`chip text-[11px] ${odNajnowszych ? "" : "chip-on"}`}>{t.artist.sortOldest}</Link>
              <Link href={`/artist/${mbid}?plyty=nowe`} className={`chip text-[11px] ${odNajnowszych ? "chip-on" : ""}`}>{t.artist.sortNewest}</Link>
            </div>
          </div>

          {/* „Ta jedna płyta" na górze — punkt wejścia dla kogoś, kto zespołu nie
              zna. Zostaje też niżej, na swoim miejscu w czasie: inaczej dorobek
              miałby dziurę i nie dałoby się go przejrzeć chronologicznie. */}
          {top && (
            <div className="mb-4 rounded-lg border border-accent/50 bg-surface2 p-3">
              <div className="label mb-2 text-accent2">
                {top.source === "portal" ? t.artist.topFromPortal : t.artist.topFromMb}
              </div>
              <AlbumCard album={top.album} rating={ratings.get(top.album.mbid)} />
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            {chronologicznie.map((a) => (
              <AlbumCard
                key={a.mbid}
                album={a}
                rating={ratings.get(a.mbid)}
                extra={a.mbid === top?.album.mbid ? <div className="text-xs text-accent2">{t.artist.topBadge}</div> : undefined}
              />
            ))}
          </div>
        </section>
      )}
      {eps.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-2xl">{t.artist.epHeading}</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {eps.map((a) => <AlbumCard key={a.mbid} album={a} rating={ratings.get(a.mbid)} />)}
          </div>
        </section>
      )}
      {rest.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer text-lg text-muted hover:text-accent2">{fmt(t.artist.otherReleases, { n: rest.length })}</summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {rest.map((a) => <AlbumCard key={a.mbid} album={a} rating={ratings.get(a.mbid)} />)}
          </div>
        </details>
      )}
      {!disco.length && !played.length && !produced.length && <p className="mt-8 text-sm text-muted">{t.artist.noReleases}</p>}

      {artist.workedOn.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-1 text-2xl">{t.artist.creditsHeading} <span className="font-mono text-sm text-muted">{artist.workedOn.length}</span></h2>
          <p className="mb-3 text-xs text-muted">{t.artist.creditsNote}</p>
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
            <p className="mt-2 text-xs text-faint">{fmt(t.artist.creditsMoreNote, { n: artist.workedOn.length })}</p>
          )}
        </section>
      )}

      {artist.isPerson ? (
        <>
          {/* Odwrotność osi zespołu: po lewej zespoły, na paskach płyty nagrane
              w danym okresie. Sidemani też — u nich to często najważniejsze granie. */}
          <CareerTimeline name={artist.name} bands={artist.memberOf} albumsByBand={bandAlbums} own={albums} locale={locale} t={t.artist.timeline} />
          {/* Solista to też zespół: Ozzy Osbourne wydaje pod własnym nazwiskiem,
              ale te płyty ktoś z nim nagrał i te składy się zmieniały. Skoro
              MusicBrainz wie kto i kiedy, rysujemy mu zwykłą oś składu — obok
              osi „gdzie grał", bo to dwie różne historie tej samej osoby. */}
          {ownBand.length > 0 && (
            <LineupTimeline members={ownBand} albums={albums} locale={locale} t={t.artist.timeline} />
          )}
        </>
      ) : (
        <LineupTimeline members={artist.members.filter((m) => !m.supporting)} albums={albums} locale={locale} t={t.artist.timeline} />
      )}

      <Suspense fallback={<p className="mt-10 font-mono text-xs text-muted">{t.artist.concertsLoading}</p>}>
        <ConcertsSection mbid={mbid} name={artist.name} locale={locale} t={t} />
      </Suspense>

      <Suspense fallback={<p className="mt-10 font-mono text-xs text-muted">{t.artist.crewLoading}</p>}>
        <CrewSection albums={albums.length ? albums : disco.slice(0, 6)} t={t} />
      </Suspense>

      <Suspense fallback={<p className="mt-10 font-mono text-xs text-muted">{t.artist.relatedLoading}</p>}>
        <RelatedSection artist={artist} t={t} />
      </Suspense>

      <YoutubeVideos query={artist.isPerson ? artist.name : `${artist.name} band`} />
    </>
  );
}

function DeepContentLoading({ t }: { t: Dict }) {
  return (
    <div className="mt-8 flex items-center gap-3 text-sm text-muted">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-rule border-t-accent" />
      {t.artist.deepLoading}
    </div>
  );
}

export default async function ArtistPage({
  params,
  searchParams,
}: {
  params: Promise<{ mbid: string }>;
  searchParams: Promise<{ plyty?: string }>;
}) {
  const { mbid } = await params;
  const odNajnowszych = (await searchParams).plyty === "nowe";
  if (!UUID.test(mbid)) notFound();
  const { locale, t } = await i18n();
  let artist;
  try {
    artist = await getArtist(mbid);
  } catch (e) {
    if (e instanceof MbError && e.status === 404) notFound();
    // 503/limit zapytań: spokojny komunikat zamiast czerwonego ekranu.
    if (e instanceof MbError) return <MbUnavailable what={t.artist.mbUnavailableWhat} />;
    throw e;
  }
  const user = await currentUser();
  // Przez dbSafe: padnięta baza ma nie zabierać treści z MusicBrainz/Wikipedii.
  // Gatunków szukamy dalej niż w MusicBrainz: przy mniejszych zespołach MB nie ma
  // ani jednego tagu i strona wygląda na pustą. Pytamy tylko wtedy, gdy naprawdę
  // nie ma czego pokazać — i piszemy potem, skąd to wzięliśmy.
  const [summaryS, treeS, favS, favsS, wiki, logo, wdStyles] = await Promise.all([
    dbSafe(ratingSummary("ARTIST", mbid, user?.id), EMPTY_SUMMARY),
    dbSafe(commentTree("ARTIST", mbid), []),
    dbSafe(user ? artistSentiment(user.id, mbid) : Promise.resolve(null), null as "like" | "dislike" | null),
    dbSafe(favoriteCount(mbid), 0),
    wikiFromLinks(artist.links, wikiLangs(locale)).catch(() => null),
    wikiLogo(artist.links).catch(() => null),
    // Kolejność szukania stylu: gatunki z MusicBrainz → jego tagi (mniej
    // wypieszczone, ale przy mniejszych zespołach to jedyne, co jest) → dopiero
    // Wikidane. Venomous Concept miał pusty nagłówek, choć „hardcore punk" wisi
    // i w tagach MB, i w pierwszym zdaniu Wikipedii.
    artist.genres.length || artist.tags.length ? Promise.resolve([] as string[]) : wdGenres(artist.links, locale).catch(() => []),
  ]);
  const [summary, tree, fav, favs] = [summaryS.value, treeS.value, favS.value, favsS.value];
  const [mojeListy, naListach] = user
    ? await Promise.all([getMyLists(user.id).catch(() => []), listsWith(user.id, "ARTIST", mbid).catch(() => [])])
    : [[] as Awaited<ReturnType<typeof getMyLists>>, [] as string[]];
  const dbDown = summaryS.failed || treeS.failed || favS.failed || favsS.failed;

  // Styl zespołu z pierwszego źródła, które cokolwiek wie.
  const style = artist.genres.length
    ? { items: artist.genres, source: "genres" as const }
    : artist.tags.length
      ? { items: artist.tags.slice(0, 6), source: "tags" as const }
      : { items: wdStyles, source: "wikidata" as const };

  const meta = [
    artist.isPerson ? t.artist.personType : artist.type?.toLowerCase(),
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
            {artist.aliases.length > 0 && <div className="text-xs text-faint">{t.artist.aka} {artist.aliases.join(", ")}</div>}
            {style.items.length > 0 && (
              <>
                <div className="mt-2 flex flex-wrap gap-1">
                  {style.items.map((g) => (
                    <Link key={g} href={`/szukaj?q=${encodeURIComponent(g)}`} className="chip">{g}</Link>
                  ))}
                </div>
                {/* Uczciwie mówimy, skąd to jest, gdy nie z gatunków MusicBrainz. */}
                {style.source !== "genres" && (
                  <p className="mt-1 font-mono text-[10px] text-faint">
                    {style.source === "tags" ? t.artist.genresFromTags : t.artist.genresFromWikidata}
                  </p>
                )}
              </>
            )}
            {!style.items.length && <p className="mt-2 text-xs text-faint">{t.artist.noGenres}</p>}
            <div className="mt-3"><LinksRow links={artist.links} wikiUrl={wiki?.url} /></div>
            <div className="mt-3 flex items-center gap-3">
              {user ? (
                <>
                  <form action={toggleFavorite}>
                    <input type="hidden" name="mbid" value={mbid} />
                    <input type="hidden" name="current" value={fav ?? ""} />
                    <input type="hidden" name="kind" value="like" />
                    <input type="hidden" name="name" value={artist.name} />
                    <button className={`btn ${fav === "like" ? "btn-accent" : ""}`}>
                      {fav === "like" ? t.artist.favoriteActive : t.artist.favoriteAdd}
                    </button>
                  </form>
                  <form action={toggleFavorite}>
                    <input type="hidden" name="mbid" value={mbid} />
                    <input type="hidden" name="current" value={fav ?? ""} />
                    <input type="hidden" name="kind" value="dislike" />
                    <input type="hidden" name="name" value={artist.name} />
                    <button className={`btn ${fav === "dislike" ? "btn-warn" : ""}`}>
                      {fav === "dislike" ? t.artist.dislikeActive : t.artist.dislikeAdd}
                    </button>
                  </form>
                </>
              ) : (
                <Link href={`/login?callbackUrl=/artist/${mbid}`} className="btn">{t.artist.favoriteAdd}</Link>
              )}
              {user && (
                <AddToList
                  type="ARTIST"
                  mbid={mbid}
                  label={artist.name}
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
              {favs > 0 && <span className="font-mono text-xs text-muted">{fmt(t.artist.favoritesCount, { n: favs })}</span>}
            </div>
          </div>
        </header>

        {wiki && (
          <section className="mt-6 text-sm text-text2">
            <p>{wiki.extract}</p>
            <a href={wiki.url} target="_blank" rel="noopener" className="text-xs text-muted hover:text-accent2">{fmt(t.common.wikipediaLink, { lang: wiki.lang })}</a>
          </section>
        )}

        <Suspense fallback={<DeepContentLoading t={t} />}>
          <ArtistDeepContent artist={artist} mbid={mbid} locale={locale} t={t} odNajnowszych={odNajnowszych} />
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
