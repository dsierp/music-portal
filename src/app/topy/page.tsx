import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getFavoriteArtists, getLikedAlbums, getUserLocale, myRatings } from "@/lib/user-data";
import { najczesciejGrani, najczesciejGranePlyty } from "@/lib/grane";
import { Kafelki } from "@/components/kafelki";
import { i18n } from "@/lib/t";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await i18n();
  return { title: t.nav.myTops };
}
export const dynamic = "force-dynamic";

/**
 * „Moje topy" — wszystko, co człowiek sam o sobie powiedział portalowi,
 * zebrane w jednym miejscu: oceny, ★ i to, czego słucha najczęściej.
 *
 * Dotąd te rzeczy leżały w trzech miejscach (profil, strona główna, „Co
 * grałem") i żadne nie odpowiadało na proste „co jest moje najlepsze".
 * Strona niczego nie liczy po swojemu — to te same dane, tylko ułożone.
 */
export default async function TopyPage() {
  const user = await currentUser();
  if (!user) redirect("/login?callbackUrl=/topy");
  const { t } = await i18n(await getUserLocale(user.id).catch(() => null));

  const [oceny, lubiane, artysci, grani, granePlyty] = await Promise.all([
    myRatings(user.id, "ALBUM").catch(() => []),
    getLikedAlbums(user.id).catch(() => []),
    getFavoriteArtists(user.id).catch(() => []),
    najczesciejGrani(user.id, 24).catch(() => []),
    najczesciejGranePlyty(user.id, 12).catch(() => []),
  ]);
  // Najwyżej ocenione: najpierw ocena, przy remisie świeższa — to, co
  // człowiek ocenił ostatnio, lepiej oddaje jego dzisiejszy gust.
  const najlepsze = [...oceny]
    .sort((a, b) => b.score - a.score || +b.updatedAt - +a.updatedAt)
    .slice(0, 24);

  const pusto = !najlepsze.length && !lubiane.length && !artysci.length && !grani.length;

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-4xl">{t.nav.myTops}</h1>
        <p className="mt-2 max-w-2xl text-sm text-text2">{t.nav.topsIntro}</p>
      </header>

      {pusto && <p className="card text-sm text-muted">{t.nav.topsEmpty}</p>}

      {najlepsze.length > 0 && (
        <section>
          <h2 className="text-3xl">{t.nav.topsRated}</h2>
          <Kafelki
            items={najlepsze.map((r) => {
              const [artysta, ...reszta] = (r.label ?? "").split(/\s+[–—-]\s+/);
              const tytul = reszta.join(" – ");
              return {
                key: `r-${r.targetMbid}`,
                href: `/album/${r.targetMbid}`,
                mbid: r.targetMbid,
                title: tytul || r.label || r.targetMbid,
                subtitle: tytul ? artysta : null,
                meta: `★ ${r.score}`,
              };
            })}
          />
        </section>
      )}

      {granePlyty.length > 0 && (
        <section>
          <h2 className="text-3xl">{t.nav.topsPlayedAlbums}</h2>
          <Kafelki
            items={granePlyty.map((p) => ({
              key: `g-${p.artist}-${p.album}`,
              href: p.mbid ? `/album/${p.mbid}` : `/szukaj?q=${encodeURIComponent(`${p.artist} ${p.album}`)}`,
              mbid: p.mbid,
              title: p.album,
              subtitle: p.artist,
              meta: `${p.ile}×`,
            }))}
          />
        </section>
      )}

      {grani.length > 0 && (
        <section>
          <h2 className="text-3xl">{t.nav.topsPlayedArtists}</h2>
          <ol className="mt-4 flex flex-wrap gap-2">
            {grani.map((g) => (
              <li key={g.artist}>
                <Link href={`/szukaj?q=${encodeURIComponent(g.artist)}`} className="chip hover:text-accent2">
                  {g.artist} <span className="text-faint">· {g.ile}</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      {lubiane.length > 0 && (
        <section>
          <h2 className="text-3xl">{t.nav.topsLiked}</h2>
          <Kafelki
            items={lubiane.map((a) => ({
              key: `l-${a.mbid}`,
              href: `/album/${a.mbid}`,
              mbid: a.mbid,
              title: a.title,
              subtitle: a.artistName,
            }))}
          />
        </section>
      )}

      {artysci.length > 0 && (
        <section>
          <h2 className="text-3xl">{t.nav.topsArtists}</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {artysci.map((a) => (
              <li key={a.mbid}>
                <Link href={`/artist/${a.mbid}`} className="chip hover:text-accent2">★ {a.name}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
