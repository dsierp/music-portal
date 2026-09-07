import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { latestSections, releasesFor, bestOfYears, bestOf, BEST_CATS } from "@/lib/lists";
import { ReleaseRow } from "@/components/release-list";
import { SearchBox } from "@/components/search-box";
import { getFavoriteArtists, getGenres, getLikedAlbums, recentComments } from "@/lib/user-data";
import { genreToSection } from "@/lib/genres";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await currentUser();
  const sections = await latestSections(2);
  const rel = await releasesFor(sections.map((s) => s.id));
  const years = await bestOfYears();
  const best = years[0] ? await bestOf(years[0].year) : null;
  const recent = await recentComments(6);

  let prefSections: Set<string> | null = null;
  let liked: Awaited<ReturnType<typeof getLikedAlbums>> = [];
  let favs: Awaited<ReturnType<typeof getFavoriteArtists>> = [];
  if (user) {
    const genres = await getGenres(user.id);
    const s = new Set(genres.filter((g) => g.weight >= 3).map((g) => genreToSection(g.genre)).filter(Boolean) as string[]);
    prefSections = s.size ? s : null;
    [liked, favs] = await Promise.all([getLikedAlbums(user.id), getFavoriteArtists(user.id)]);
  }
  const stars = rel.filter((r) => r.star === 1 && (!prefSections || prefSections.has(r.genre)));

  return (
    <div className="space-y-10">
      <section className="rounded-xl border border-rule bg-gradient-to-br from-surface to-bg p-6 sm:p-10">
        <h1 className="text-5xl leading-none">Podróż po muzyce</h1>
        <p className="mt-3 max-w-2xl text-text2">
          Premiery co piątek, best of roku i najważniejsze: <b className="text-text">z płyty do muzyka, z muzyka do jego innych płyt</b>. Metal, prog, jazz.
        </p>
        <div className="mt-5 max-w-xl"><SearchBox big /></div>
        {!user && <p className="mt-3 text-sm text-muted"><Link href="/login" className="underline">Zaloguj się</Link>, żeby ustawić preferencje, oceniać i komentować.</p>}
      </section>

      <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-3xl">Premiery {prefSections ? "dla Ciebie" : "tygodnia"}</h2>
            <Link href="/premiery" className="text-sm text-muted hover:text-accent2">wszystkie →</Link>
          </div>
          {sections.map((s) => {
            const items = stars.filter((r) => r.sectionId === s.id);
            if (!items.length) return null;
            return (
              <div key={s.id} className="mt-4">
                <h3 className="label mb-2">{s.title} {s.date}</h3>
                <ul className="space-y-3">{items.map((r) => <ReleaseRow key={r.id} r={r} />)}</ul>
              </div>
            );
          })}
          {!stars.length && <p className="mt-3 text-sm text-muted">Brak premier — zaimportuj listę (<code>npm run import:pns</code>).</p>}
        </section>

        <aside className="space-y-6">
          {best && (
            <section className="card">
              <div className="flex items-baseline justify-between">
                <h2 className="text-xl">Best of {best.year?.label}</h2>
                <Link href="/best-of" className="text-xs text-muted hover:text-accent2">całość →</Link>
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {Object.keys(BEST_CATS).map((c) => {
                  const top = best.entries.find((e) => e.category === c && e.rank === 1);
                  if (!top) return null;
                  return (
                    <li key={c}>
                      <span className="label mr-1">{c}</span>
                      <Link href={`/go/best/${top.id}`} className="hover:text-accent2">{top.artist} – <i>{top.album}</i></Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          {user && (favs.length > 0 || liked.length > 0) && (
            <section className="card">
              <h2 className="text-xl">Twoje</h2>
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
              <Link href="/ja" className="mt-2 block text-xs text-muted hover:text-accent2">profil i preferencje →</Link>
            </section>
          )}
          {recent.length > 0 && (
            <section className="card">
              <h2 className="text-xl">Ostatnie komentarze</h2>
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
