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
import { getFavoriteArtists, getGenres, getLikedAlbums, recentComments } from "@/lib/user-data";
import { genreToSection } from "@/lib/genres";
import { SKIP_ONBOARDING } from "@/lib/onboarding";

export const dynamic = "force-dynamic";

/**
 * „Kto zmienił zespół" — osobny strumień, bo to jedno zapytanie do MusicBrainz
 * na zespół (limit 1/s). Strona główna nie ma na to czekać.
 */
async function LineupNews({ bands, favorites }: { bands: { mbid: string; name: string }[]; favorites: Set<string> }) {
  if (!bands.length) return null;
  const news = await lineupNews(bands, favorites).catch(() => []);
  if (!news.length) return null;
  return (
    <section>
      <h2 className="text-3xl">Zmiany w składach</h2>
      <p className="mb-3 text-sm text-muted">
        Z dat członkostwa w MusicBrainz — ostatnie półtora roku. ★ to Twoje ulubione zespoły.
      </p>
      <ul className="space-y-1.5">
        {news.map((n, i) => (
          <li key={`${n.artistMbid}-${n.personMbid}-${n.kind}-${i}`} className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className={n.kind === "joined" ? "text-ok" : "text-warn"}>{n.kind === "joined" ? "+" : "−"}</span>
            <Link href={`/artist/${n.personMbid}`} className="font-medium hover:text-accent2 hover:underline">{n.personName}</Link>
            <span className="text-muted">{n.kind === "joined" ? "dołączył(a) do" : "odszedł(-ła) z"}</span>
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
  if (user) {
    const genres = await getGenres(user.id);
    const s = new Set(genres.filter((g) => g.weight >= 3).map((g) => genreToSection(g.genre)).filter(Boolean) as string[]);
    prefSections = s.size ? s : null;
    [liked, favs] = await Promise.all([getLikedAlbums(user.id), getFavoriteArtists(user.id)]);
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
      <Banner image="/img/studio.jpg" title="Podróż po muzyce" position="center 40%">
        <p className="mt-3 max-w-2xl text-text2">
          Twoja podróż z muzyką zaczyna się tutaj. Zanurz się w tym wspaniałym świecie, podróżuj
          <b className="text-text"> odwiedzając artystów i ich kolejne przystanie</b>. Zapraszamy.
        </p>
        <div className="mt-5 max-w-xl"><SearchBox big /></div>
        {!user && <p className="mt-3 text-sm text-muted"><Link href="/login" className="underline">Zaloguj się</Link>, żeby ustawić preferencje, oceniać i komentować.</p>}
      </Banner>

      <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
        <Suspense fallback={<p className="font-mono text-xs text-muted">Sprawdzam zmiany w składach…</p>}>
          <LineupNews bands={newsBands} favorites={favMbids} />
        </Suspense>

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
