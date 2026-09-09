import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { latestSections, releasesFor, bestOfYears, bestOf, BEST_CATS } from "@/lib/lists";
import { ReleaseRow } from "@/components/release-list";
import { SearchBox } from "@/components/search-box";
import { Banner } from "@/components/banner";
import { Suspense } from "react";
import { lineupNews } from "@/lib/lineup-news";
import { getFavoriteArtists, getGenres, getLikedAlbums, getMyLists, listsForMe, recentComments, travelJournal } from "@/lib/user-data";
import { TravelJournal } from "@/components/travel-journal";
import type { JournalEvent } from "@/lib/journal";
import { genreToSection } from "@/lib/genres";
import { SKIP_ONBOARDING } from "@/lib/onboarding";
import { i18n } from "@/lib/t";
import { fmt, plural } from "@/lib/i18n";
import { genreLabel } from "@/lib/dict";
import type { Dict } from "@/lib/dict";

export const dynamic = "force-dynamic";

/**
 * „Kto zmienił zespół" — osobny strumień, bo to jedno zapytanie do MusicBrainz
 * na zespół (limit 1/s). Strona główna nie ma na to czekać.
 */
async function LineupNews({ bands, favorites, t }: { bands: { mbid: string; name: string }[]; favorites: Set<string>; t: Dict["home"] }) {
  if (!bands.length) return null;
  const news = await lineupNews(bands, favorites).catch(() => []);
  if (!news.length) return null;
  return (
    <section>
      <h2 className="text-3xl">{t.lineupTitle}</h2>
      <p className="mb-3 text-sm text-muted">{t.lineupNote}</p>
      <ul className="space-y-1.5">
        {news.map((n, i) => (
          <li key={`${n.artistMbid}-${n.personMbid}-${n.kind}-${i}`} className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className={n.kind === "joined" ? "text-ok" : "text-warn"}>{n.kind === "joined" ? "+" : "−"}</span>
            <Link href={`/artist/${n.personMbid}`} className="font-medium hover:text-accent2 hover:underline">{n.personName}</Link>
            <span className="text-muted">{n.kind === "joined" ? t.joined : t.left}</span>
            <Link href={`/artist/${n.artistMbid}`} className="font-medium hover:text-accent2 hover:underline">
              {n.favorite && <span className="text-accent2">★ </span>}{n.artistName}
            </Link>
            {n.roles.length > 0 && <span className="font-mono text-[10px] text-faint">{n.roles.join(", ")}</span>}
            <span className="font-mono text-[10px] text-muted">{n.date}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function Home() {
  const { locale, t } = await i18n();
  const user = await currentUser();
  // Pierwsze wejście po zalogowaniu: nikt nie ma jeszcze stylów, a bez nich
  // portal nie wie, co komu pokazywać — więc zamiast wpuszczać na stronę
  // główną z domyślną oprawą, prowadzimy prosto do wyboru gatunków.
  // „Później" ustawia ciasteczko i drugi raz już nie zaczepiamy.
  if (user && !(await cookies()).get(SKIP_ONBOARDING)?.value) {
    const genres = await getGenres(user.id).catch(() => [] as { genre: string; weight: number }[]);
    if (!genres.length) redirect("/ja?witaj=1");
  }
  const sections = await latestSections(2);
  const rel = await releasesFor(sections.map((s) => s.id));
  const years = await bestOfYears();
  const best = years[0] ? await bestOf(years[0].year) : null;
  const recent = await recentComments(6);

  let prefSections: Set<string> | null = null;
  let liked: Awaited<ReturnType<typeof getLikedAlbums>> = [];
  let favs: Awaited<ReturnType<typeof getFavoriteArtists>> = [];
  let mojeListy: Awaited<ReturnType<typeof getMyLists>> = [];
  let dlaMnie: Awaited<ReturnType<typeof listsForMe>> = [];
  let dziennik: JournalEvent[] = [];
  if (user) {
    const genres = await getGenres(user.id);
    const s = new Set(genres.filter((g) => g.weight >= 3).map((g) => genreToSection(g.genre)).filter(Boolean) as string[]);
    prefSections = s.size ? s : null;
    [liked, favs] = await Promise.all([getLikedAlbums(user.id), getFavoriteArtists(user.id)]);
    // Listy na stronie głównej: to jest to, po co człowiek tu wraca — własna
    // kolejka do posłuchania i to, co ktoś mu podsunął.
    [mojeListy, dlaMnie, dziennik] = await Promise.all([
      getMyLists(user.id).catch(() => []),
      listsForMe(user.id).catch(() => []),
      // Dziennik: ślad po tym, co człowiek tu porobił. Awaria nie ma wywalać
      // strony głównej — najwyżej nie będzie tej jednej karty.
      travelJournal(user.id, 12).catch(() => []),
    ]);
  }
  const stars = rel.filter((r) => r.star === 1 && (!prefSections || prefSections.has(r.genre)));

  // Zmiany składów sprawdzamy w Twoich ulubionych zespołach (★).
  // Premier tu nie doważamy: tabela premier trzyma MBID PŁYTY, nie zespołu, więc
  // pytanie o nie MusicBrainz kończyłoby się serią chybionych zapytań. Żeby objąć
  // tym całe kategorie, trzeba najpierw rozwiązać artystów — osobny temat.
  const favMbids = new Set(favs.map((f) => f.mbid));
  const newsBands = favs.map((f) => ({ mbid: f.mbid, name: f.name })).slice(0, 10);

  return (
    <div className="space-y-10">
      <Banner image="/img/studio.jpg" title={t.home.heroTitle} position="center 40%">
        <p className="mt-3 max-w-2xl text-text2">
          {t.home.heroTextBefore}
          <b className="text-text">{t.home.heroTextBold}</b>{t.home.heroTextAfter}
        </p>
        <div className="mt-5 max-w-xl"><SearchBox big placeholder={t.nav.searchPlaceholder} label={t.nav.search} /></div>
        {!user && <p className="mt-3 text-sm text-muted"><Link href="/login" className="underline">{t.home.loginCta}</Link>{t.home.loginPromptRest}</p>}
      </Banner>

      <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
        <Suspense fallback={<p className="font-mono text-xs text-muted">{t.home.lineupLoading}</p>}>
          <LineupNews bands={newsBands} favorites={favMbids} t={t.home} />
        </Suspense>

        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-3xl">{prefSections ? t.home.releasesForYou : t.home.releasesThisWeek}</h2>
            <Link href="/premiery" className="text-sm text-muted hover:text-accent2">{t.home.allReleases}</Link>
          </div>
          {sections.map((s) => {
            const items = stars.filter((r) => r.sectionId === s.id);
            if (!items.length) return null;
            return (
              <div key={s.id} className="mt-4">
                <h3 className="label mb-2">{s.title} {s.date}</h3>
                <ul className="space-y-3">{items.map((r) => <ReleaseRow key={r.id} r={r} t={t} />)}</ul>
              </div>
            );
          })}
          {!stars.length && <p className="mt-3 text-sm text-muted">{t.home.noReleasesBefore}<code>npm run import:pns</code>{t.home.noReleasesAfter}</p>}
        </section>

        <aside className="space-y-6">
          <TravelJournal events={dziennik} locale={locale} t={t} more="/listy#dziennik" />
          {user && (mojeListy.length > 0 || dlaMnie.length > 0) && (
            <section className="card">
              <div className="flex items-baseline justify-between">
                <h2 className="text-xl">{t.lists.myListsTitle}</h2>
                <Link href="/listy" className="text-xs text-muted hover:text-accent2">{t.common.showAll} →</Link>
              </div>
              {dlaMnie.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm">
                  {dlaMnie.slice(0, 4).map((l) => (
                    <li key={`s-${l.id}`} className="flex items-baseline justify-between gap-2">
                      <Link href={`/podroz/${l.id}`} className="truncate hover:text-accent2">
                        <span className="text-accent2">★ </span>{l.title}
                      </Link>
                      <span className="shrink-0 font-mono text-[10px] text-faint">{fmt(t.lists.sharedBy, { name: l.from })}</span>
                    </li>
                  ))}
                </ul>
              )}
              {mojeListy.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm">
                  {mojeListy.slice(0, 5).map((l) => (
                    <li key={l.id} className="flex items-baseline justify-between gap-2">
                      <Link href={`/podroz/${l.id}`} className="truncate hover:text-accent2">{l.title}</Link>
                      <span className="shrink-0 font-mono text-[10px] text-faint">{plural(locale, l.items, t.lists.itemsCount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          {best && (
            <section className="card">
              <div className="flex items-baseline justify-between">
                <h2 className="text-xl">{fmt(t.home.bestOfTitle, { year: best.year?.label ?? "" })}</h2>
                <Link href="/best-of" className="text-xs text-muted hover:text-accent2">{t.home.bestOfAll}</Link>
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {Object.keys(BEST_CATS).map((c) => {
                  const top = best.entries.find((e) => e.category === c && e.rank === 1);
                  if (!top) return null;
                  return (
                    <li key={c}>
                      <span className="label mr-1">{genreLabel(c, t, BEST_CATS[c])}</span>
                      <Link href={`/go/best/${top.id}`} className="hover:text-accent2">{top.artist} – <i>{top.album}</i></Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          {user && (favs.length > 0 || liked.length > 0) && (
            <section className="card">
              <h2 className="text-xl">{t.home.yours}</h2>
              {favs.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {favs.slice(0, 12).map((f) => <Link key={f.mbid} href={`/artist/${f.mbid}`} className="chip">{f.name}</Link>)}
                </div>
              )}
              {liked.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm">
                  {liked.slice(0, 6).map((a) => (
                    <li key={a.mbid}><Link href={`/album/${a.mbid}`} className="hover:text-accent2">{a.artistName} – <i>{a.title}</i></Link></li>
                  ))}
                </ul>
              )}
              <Link href="/ja" className="mt-2 block text-xs text-muted hover:text-accent2">{t.home.manageProfile}</Link>
            </section>
          )}
          {recent.length > 0 && (
            <section className="card">
              <h2 className="text-xl">{t.home.recentComments}</h2>
              <ul className="mt-2 space-y-2 text-sm">
                {recent.map((c) => (
                  <li key={c.id}>
                    <Link href={c.targetType === "ALBUM" ? `/album/${c.targetMbid}` : `/artist/${c.targetMbid}`} className="block text-text2 hover:text-accent2">
                      <span className="text-xs text-muted">{c.userName || c.userEmail.split("@")[0]}:</span> {c.body.length > 90 ? c.body.slice(0, 90) + "…" : c.body}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
