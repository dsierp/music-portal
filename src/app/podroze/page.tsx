import Link from "next/link";
import { Banner } from "@/components/banner";
import type { Metadata } from "next";
import { desc, isNotNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { mostCommented, topRated } from "@/lib/user-data";
import { currentUser } from "@/lib/auth";
import { getFavoriteArtists, getLikedAlbums, getMyLists, listsForMe, travelJournal } from "@/lib/user-data";
import { TravelJournal } from "@/components/travel-journal";
import { createListAction, deleteListAction, dismissShareAction } from "@/app/actions";
import { i18n } from "@/lib/t";
import { ScreenHelp } from "@/components/screen-help";
import { fmt, plural } from "@/lib/i18n";

/** Tytuł w zakładce też idzie w języku czytelnika. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await i18n();
  return { title: t.nav.lists };
}
export const dynamic = "force-dynamic";

/** Nazwa wyświetlana dla MBID: z migawek ocen (label) albo z ulubionych. */
async function labelsFor(type: "ALBUM" | "ARTIST", mbids: string[]) {
  const out = new Map<string, string>();
  if (!mbids.length) return out;
  const rows = await db.select({ mbid: schema.ratings.targetMbid, label: schema.ratings.label }).from(schema.ratings)
    .where(sql`${schema.ratings.targetType} = ${type} and ${schema.ratings.targetMbid} in ${mbids} and ${schema.ratings.label} is not null`);
  for (const r of rows) if (r.label) out.set(r.mbid, r.label);
  if (type === "ALBUM") {
    const liked = await db.select({ mbid: schema.likedAlbums.mbid, t: schema.likedAlbums.title, a: schema.likedAlbums.artistName }).from(schema.likedAlbums).where(sql`${schema.likedAlbums.mbid} in ${mbids}`);
    for (const r of liked) if (!out.has(r.mbid)) out.set(r.mbid, `${r.a} – ${r.t}`);
  } else {
    const favs = await db.select({ mbid: schema.favoriteArtists.mbid, n: schema.favoriteArtists.name }).from(schema.favoriteArtists).where(sql`${schema.favoriteArtists.mbid} in ${mbids}`);
    for (const r of favs) if (!out.has(r.mbid)) out.set(r.mbid, r.n);
  }
  return out;
}

export default async function ListsPage({ searchParams }: { searchParams: Promise<{ usun?: string }> }) {
  // Numer podróży, o której usunięcie właśnie pytamy. Kasowanie idzie przez
  // adres, a nie przez okienko: jest serwerowe, działa bez JavaScriptu
  // i — najważniejsze — daje jeden krok na zastanowienie się. Wcześniej
  // jedyny przycisk kasował od razu, bez pytania.
  const doUsuniecia = (await searchParams).usun ?? null;
  const { locale, t } = await i18n();
  const user = await currentUser();
  const [topAlbums, topArtists, comAlbums, comArtists] = await Promise.all([topRated("ALBUM", 15), topRated("ARTIST", 15), mostCommented("ALBUM", 10), mostCommented("ARTIST", 10)]);
  const dziennik = user ? await travelJournal(user.id, 80).catch(() => []) : [];
  const [moje, dlaMnie] = user
    ? await Promise.all([getMyLists(user.id).catch(() => []), listsForMe(user.id).catch(() => [])])
    : [[] as Awaited<ReturnType<typeof getMyLists>>, [] as Awaited<ReturnType<typeof listsForMe>>];
  const mostLiked = await db.select({ mbid: schema.likedAlbums.mbid, n: sql<number>`count(*)` }).from(schema.likedAlbums).groupBy(schema.likedAlbums.mbid).orderBy(desc(sql`count(*)`)).limit(15);
  const mostFav = await db.select({ mbid: schema.favoriteArtists.mbid, n: sql<number>`count(*)` }).from(schema.favoriteArtists).groupBy(schema.favoriteArtists.mbid).orderBy(desc(sql`count(*)`)).limit(15);
  const albumIds = [...new Set([...topAlbums, ...comAlbums, ...mostLiked].map((x) => x.mbid))];
  const artistIds = [...new Set([...topArtists, ...comArtists, ...mostFav].map((x) => x.mbid))];
  const [al, ar] = await Promise.all([labelsFor("ALBUM", albumIds), labelsFor("ARTIST", artistIds)]);
  const mine = user ? await Promise.all([getLikedAlbums(user.id), getFavoriteArtists(user.id)]) : null;
  const resolved = await db.select({ n: sql<number>`count(*)` }).from(schema.releases).where(isNotNull(schema.releases.mbid));

  const List = ({ title, items, type, suffix }: { title: string; items: { mbid: string; v: string }[]; type: "album" | "artist"; suffix?: string }) => (
    <section className="card">
      <h2 className="text-xl">{title}</h2>
      {items.length ? (
        <ol className="mt-2 space-y-1 text-sm">
          {items.map((x, i) => (
            <li key={x.mbid} className="flex gap-2">
              <span className="w-5 text-right font-mono text-xs text-faint">{i + 1}</span>
              <Link href={`/${type}/${x.mbid}`} className="min-w-0 flex-1 truncate hover:text-accent2">{(type === "album" ? al : ar).get(x.mbid) ?? x.mbid}</Link>
              <span className="font-mono text-xs text-accent2">{x.v}{suffix}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 text-sm text-muted">{t.lists.emptyList}</p>
      )}
    </section>
  );

  return (
    <div className="space-y-8">
      <Banner image="/img/mapa.jpg" title={t.lists.bannerTitle} position="center 45%">
        <p className="mt-2 text-sm text-muted">
          {t.lists.bannerIntro}<Link href="/premiery" className="underline">{t.lists.weeklyReleasesLink}</Link>
          {fmt(t.lists.bannerConnected, { n: Number(resolved[0]?.n ?? 0) })}
          <Link href="/best-of" className="underline">{t.lists.bestOfLink}</Link>{t.lists.bannerOutro}
        </p>
      </Banner>
      <ScreenHelp screen="podroze" />
      {/* Wejście do podróży „w nieznane".
          Najpierw była to zwykła ramka z tekstem w środku strony — i okazała
          się nie do znalezienia: dwa razy szukana, dwa razy przeoczona.
          Dostaje więc własny baner na górze, z tym samym ciężarem co nagłówki
          pozostałych ekranów. Sztorm pasuje: to jedyne miejsce w portalu,
          gdzie wypływa się bez mapy. */}
      <Link href="/rozmowa" className="group block">
        <Banner image="/img/statek.jpg" title={t.chat.title} position="center 45%" compact>
          <p className="mt-3 max-w-2xl text-text2">{t.chat.lead}</p>
          <p className="mt-4 inline-block rounded-full border border-accent/50 px-4 py-1 font-mono text-xs text-accent2 transition-colors group-hover:bg-accent/15">
            {t.chat.cta} →
          </p>
        </Banner>
      </Link>
      {/* Własne listy najpierw: rankingi portalu są ciekawe, ale to, co człowiek
          sam ułożył (i co dostał od kogoś), jest jego. */}
      {user && (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="card">
            <h2 className="text-xl">{t.lists.myListsTitle}</h2>
            <p className="mt-1 text-xs text-muted">{t.lists.myListsIntro}</p>
            {moje.length ? (
              <ul className="mt-3 space-y-1 text-sm">
                {moje.map((l) => (
                  <li key={l.id} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <Link href={`/podroz/${l.id}`} className="truncate font-medium hover:text-accent2">{l.title}</Link>
                      <span className="flex shrink-0 items-baseline gap-3">
                        <span className="font-mono text-[10px] text-faint">{plural(locale, l.items, t.lists.itemsCount)}</span>
                        {doUsuniecia !== l.id && (
                          <Link href={`/podroze?usun=${l.id}`} className="text-[10px] text-faint hover:text-warn">{t.lists.deleteList}</Link>
                        )}
                      </span>
                    </div>
                    {doUsuniecia === l.id && (
                      <div className="rounded border border-warn bg-warn/10 p-2">
                        <p className="text-xs text-warn">{fmt(t.lists.deleteConfirm, { title: l.title })}</p>
                        <div className="mt-2 flex items-baseline gap-4">
                          <form action={deleteListAction}>
                            <input type="hidden" name="listId" value={l.id} />
                            <button className="text-xs font-medium text-warn hover:underline">{t.lists.deleteYes}</button>
                          </form>
                          <Link href="/podroze" className="text-xs text-muted hover:text-accent2">{t.common.cancel}</Link>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted">{t.lists.noMyLists}</p>
            )}
            <form action={createListAction} className="mt-3 space-y-2">
              <input name="title" placeholder={t.lists.newListPlaceholder} className="input py-1 text-sm" autoComplete="off" required />
              <input name="description" placeholder={t.lists.newListDescription} className="input py-1 text-sm" autoComplete="off" />
              <button className="btn">{t.lists.createList}</button>
            </form>
          </section>

          <section className="card">
            <h2 className="text-xl">{t.lists.sharedWithMeTitle}</h2>
            {dlaMnie.length ? (
              <ul className="mt-3 space-y-2 text-sm">
                {dlaMnie.map((l) => (
                  <li key={l.id} className="rounded border border-rule bg-surface2 p-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <Link href={`/podroz/${l.id}`} className="truncate font-medium hover:text-accent2">{l.title}</Link>
                      <span className="shrink-0 font-mono text-[10px] text-faint">{plural(locale, l.items, t.lists.itemsCount)}</span>
                    </div>
                    <div className="text-xs text-muted">{fmt(t.lists.sharedBy, { name: l.from })}</div>
                    {l.note && <p className="mt-0.5 text-xs text-text2">„{l.note}”</p>}
                    <form action={dismissShareAction} className="mt-1">
                      <input type="hidden" name="listId" value={l.id} />
                      <button className="text-[10px] text-faint hover:text-accent2">{t.lists.hideShare}</button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted">{t.lists.noSharedWithMe}</p>
            )}
          </section>
        </div>
      )}

      {user && (
        <div className="grid gap-4">
          {dziennik.length ? (
            <TravelJournal events={dziennik} locale={locale} t={t} />
          ) : (
            <section className="card" id="dziennik">
              <h2 className="text-xl">{t.lists.journalTitle}</h2>
              <p className="mt-2 text-sm text-muted">{t.lists.journalEmpty}</p>
            </section>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <List title={t.lists.titleTopAlbums} type="album" items={topAlbums.map((x) => ({ mbid: x.mbid, v: `${Number(x.avg).toFixed(1)} (${x.n})` }))} />
        <List title={t.lists.titleTopArtists} type="artist" items={topArtists.map((x) => ({ mbid: x.mbid, v: `${Number(x.avg).toFixed(1)} (${x.n})` }))} />
        <List title={t.lists.titleMostLiked} type="album" items={mostLiked.map((x) => ({ mbid: x.mbid, v: `♥ ${x.n}` }))} />
        <List title={t.lists.titleMostFav} type="artist" items={mostFav.map((x) => ({ mbid: x.mbid, v: `★ ${x.n}` }))} />
        <List title={t.lists.titleMostCommentedAlbums} type="album" items={comAlbums.map((x) => ({ mbid: x.mbid, v: fmt(t.lists.commentsCount, { n: x.n }) }))} />
        <List title={t.lists.titleMostCommentedArtists} type="artist" items={comArtists.map((x) => ({ mbid: x.mbid, v: fmt(t.lists.commentsCount, { n: x.n }) }))} />
      </div>
      {mine && (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="card">
            <h2 className="text-xl">{t.lists.myAlbums}</h2>
            <ul className="mt-2 space-y-1 text-sm">{mine[0].map((a) => <li key={a.mbid}><Link href={`/album/${a.mbid}`} className="hover:text-accent2">{a.artistName} – <i>{a.title}</i></Link></li>)}</ul>
            <Link href="/ja#plyty" className="mt-2 block text-xs text-muted hover:text-accent2">{t.lists.manage}</Link>
          </section>
          <section className="card">
            <h2 className="text-xl">{t.lists.myArtists}</h2>
            <div className="mt-2 flex flex-wrap gap-1">{mine[1].map((f) => <Link key={f.mbid} href={`/artist/${f.mbid}`} className="chip">{f.name}</Link>)}</div>
            <Link href="/ja#artysci" className="mt-2 block text-xs text-muted hover:text-accent2">{t.lists.manage}</Link>
          </section>
        </div>
      )}
    </div>
  );
}
