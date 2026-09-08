import Link from "next/link";
import { Banner } from "@/components/banner";
import type { Metadata } from "next";
import { desc, isNotNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { mostCommented, topRated } from "@/lib/user-data";
import { currentUser } from "@/lib/auth";
import { getFavoriteArtists, getLikedAlbums } from "@/lib/user-data";
import { i18n } from "@/lib/t";
import { fmt } from "@/lib/i18n";

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

export default async function ListsPage() {
  const { t } = await i18n();
  const user = await currentUser();
  const [topAlbums, topArtists, comAlbums, comArtists] = await Promise.all([topRated("ALBUM", 15), topRated("ARTIST", 15), mostCommented("ALBUM", 10), mostCommented("ARTIST", 10)]);
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
      <Banner image="/img/winyl.jpg" title={t.lists.bannerTitle} position="center 60%">
        <p className="mt-2 text-sm text-muted">
          {t.lists.bannerIntro}<Link href="/premiery" className="underline">{t.lists.weeklyReleasesLink}</Link>
          {fmt(t.lists.bannerConnected, { n: Number(resolved[0]?.n ?? 0) })}
          <Link href="/best-of" className="underline">{t.lists.bestOfLink}</Link>{t.lists.bannerOutro}
        </p>
      </Banner>
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
