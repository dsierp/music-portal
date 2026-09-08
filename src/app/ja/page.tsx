import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { currentUser } from "@/lib/auth";
import { getFavoriteArtists, getGenres, getLikedAlbums, myRatings } from "@/lib/user-data";
import { setGenreAction, skipOnboarding, toggleFavorite, toggleLike } from "@/app/actions";
import { MAIN_CATEGORIES, WEIGHT_LABELS } from "@/lib/genres";
import { orderByPopularity } from "@/lib/popularity";
import { genreImage } from "@/lib/genre-art";
import { Cover } from "@/components/cover";

export const metadata: Metadata = { title: "Mój profil" };
export const dynamic = "force-dynamic";

export default async function MePage({ searchParams }: { searchParams: Promise<{ witaj?: string }> }) {
  const witaj = (await searchParams).witaj === "1";
  const user = await currentUser();
  if (!user) redirect("/login?callbackUrl=/ja");
  const [genres, liked, favs, albumRatings, artistRatings] = await Promise.all([
    getGenres(user.id), getLikedAlbums(user.id), getFavoriteArtists(user.id), myRatings(user.id, "ALBUM"), myRatings(user.id, "ARTIST"),
  ]);
  const weightOf = new Map(genres.map((g) => [g.genre, g.weight]));
  // Kafelki: najpierw to, co już masz (od największej wagi), potem reszta
  // według popularności wśród użytkowników portalu.
  const bySlug = new Map(MAIN_CATEGORIES.map((c) => [c.slug, c]));
  const mineFirst = genres.slice().sort((a, b) => b.weight - a.weight).map((g) => g.genre).filter((g) => bySlug.has(g));
  const restOrder = await orderByPopularity(MAIN_CATEGORIES.map((c) => c.slug).filter((s) => !mineFirst.includes(s)));
  const tiles = [...mineFirst, ...restOrder].map((slug) => bySlug.get(slug)!);
  const custom = genres.filter((g) => !MAIN_CATEGORIES.some((c) => c.slug === g.genre));

  return (
    <div className="space-y-10">
      {witaj && (
        <section className="card border-accent/60">
          <div className="label mb-1">Witaj w portalu</div>
          <h2 className="text-2xl">Zacznijmy od tego, czego słuchasz</h2>
          <p className="mt-2 max-w-2xl text-sm text-text2">
            Wybierz poniżej kategorie, które lubisz — klikasz w kafelek, żeby dodać. Od nich zależy,
            czym portal Cię wita, w jakiej kolejności układa premiery i o czyich zmianach w składach
            Ci mówi. Zawsze możesz to zmienić na tej stronie.
          </p>
          <form action={skipOnboarding} className="mt-3">
            <button className="text-xs text-muted underline hover:text-accent2">wybiorę później</button>
          </form>
        </section>
      )}
      <header>
        <div className="label">Profil</div>
        <h1 className="text-4xl">{user.name || user.email}</h1>
        <p className="text-sm text-muted">{user.email}</p>
      </header>

      <section id="style">
        <h2 className="text-2xl">Style muzyczne</h2>
        <p className="mb-4 text-sm text-muted">Wybierz główne kategorie, których słuchasz — klikasz, żeby dodać (waga 3), potem ustawiasz wagę 1–5. Kategoria z najwyższą wagą jest Twoim stylem wiodącym: pod nią dobieramy oprawę graficzną portalu, a kategorie z wagą ≥3 filtrują premiery.</p>
        {genres.length > 0 && (
          <div className="card mb-4">
            <div className="label mb-2">Twoje style</div>
            <ul className="space-y-2">
              {genres.map((g) => (
                <li key={g.genre} className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="w-56 font-medium">{g.genre}</span>
                  <form action={setGenreAction} className="flex items-center gap-1">
                    <input type="hidden" name="genre" value={g.genre} />
                    {[1, 2, 3, 4, 5].map((w) => (
                      <button key={w} name="weight" value={w} title={WEIGHT_LABELS[w]} className={`h-7 w-7 rounded border font-mono text-xs ${g.weight === w ? "border-accent bg-accent text-white" : "border-rule bg-surface2 hover:border-accent"}`}>{w}</button>
                    ))}
                    <span className="ml-2 text-xs text-muted">{WEIGHT_LABELS[g.weight]}</span>
                    <button name="weight" value="0" className="ml-3 text-xs text-muted hover:text-accent2">usuń</button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map((c) => {
            const on = weightOf.has(c.slug);
            const img = genreImage(c.label, c.slug, c.tags[0] ?? "");
            return (
              <form key={c.slug} action={setGenreAction}>
                <input type="hidden" name="genre" value={c.slug} />
                <input type="hidden" name="weight" value={on ? "0" : "3"} />
                <button
                  className={`relative flex h-24 w-full items-end overflow-hidden rounded-lg border p-3 text-left transition-colors ${
                    on ? "border-accent" : "border-rule hover:border-accent/60"
                  }`}
                >
                  {img && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={img} alt="" aria-hidden className={`absolute inset-0 h-full w-full object-cover ${on ? "opacity-45" : "opacity-25"}`} />
                  )}
                  <span className="absolute inset-0 bg-gradient-to-t from-bg via-bg/70 to-transparent" />
                  <span className="relative">
                    <span className="display block text-lg leading-tight">{c.label}</span>
                    <span className="font-mono text-[10px] text-muted">
                      {on ? `w profilu · waga ${weightOf.get(c.slug)}` : "kliknij, żeby dodać"}
                    </span>
                  </span>
                </button>
              </form>
            );
          })}
        </div>
        {custom.length > 0 && (
          <div className="mt-4">
            <div className="label mb-1">Z wcześniejszych ustawień (podgatunki)</div>
            <div className="flex flex-wrap gap-1.5">
              {custom.map((c) => (
                <form key={c.genre} action={setGenreAction}>
                  <input type="hidden" name="genre" value={c.genre} />
                  <input type="hidden" name="weight" value="0" />
                  <button className="chip" title="kliknij, żeby usunąć">{c.genre} ✕</button>
                </form>
              ))}
            </div>
            <p className="mt-1 text-xs text-faint">
              Wybór zawęziliśmy do głównych kategorii — dla podgatunków nie da się co tydzień budować osobnych list.
              Podgatunki dalej służą do klasyfikowania płyt.
            </p>
          </div>
        )}
      </section>

      <section id="plyty">
        <div className="flex items-baseline justify-between">
          <h2 className="text-2xl">Płyty, które lubię <span className="font-mono text-sm text-muted">{liked.length}</span></h2>
          <Link href="/szukaj?lubie=1" className="btn">+ dodaj płytę</Link>
        </div>
        {liked.length ? (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {liked.map((a) => (
              <li key={a.mbid} className="flex items-center gap-3 rounded border border-rule bg-surface p-2 text-sm">
                <Cover mbid={a.mbid} size={40} />
                <div className="min-w-0 flex-1">
                  <Link href={`/album/${a.mbid}`} className="block truncate font-medium hover:text-accent2">{a.title}</Link>
                  <div className="truncate text-xs text-muted">{a.artistMbid ? <Link href={`/artist/${a.artistMbid}`} className="hover:text-accent2">{a.artistName}</Link> : a.artistName}</div>
                </div>
                <form action={toggleLike}>
                  <input type="hidden" name="mbid" value={a.mbid} />
                  <input type="hidden" name="liked" value="1" />
                  <button className="text-xs text-muted hover:text-accent2">usuń</button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">Jeszcze nic. Na stronie płyty kliknij „Lubię tę płytę” albo dodaj z wyszukiwarki.</p>
        )}
      </section>

      <section id="artysci">
        <h2 className="text-2xl">Ulubieni artyści <span className="font-mono text-sm text-muted">{favs.length}</span></h2>
        {favs.length ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {favs.map((f) => (
              <li key={f.mbid} className="flex items-center gap-2 rounded border border-rule bg-surface px-3 py-1 text-sm">
                <Link href={`/artist/${f.mbid}`} className="hover:text-accent2">{f.name}</Link>
                <form action={toggleFavorite}>
                  <input type="hidden" name="mbid" value={f.mbid} />
                  <input type="hidden" name="favorite" value="1" />
                  <input type="hidden" name="name" value={f.name} />
                  <button className="text-xs text-muted hover:text-accent2">×</button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">Na stronie artysty kliknij „Do ulubionych”.</p>
        )}
      </section>

      <section id="oceny" className="grid gap-6 sm:grid-cols-2">
        <div>
          <h2 className="text-2xl">Moje oceny płyt <span className="font-mono text-sm text-muted">{albumRatings.length}</span></h2>
          <ul className="mt-2 space-y-1 text-sm">
            {albumRatings.slice(0, 30).map((r) => (
              <li key={r.targetMbid} className="flex gap-2"><span className="w-8 font-mono text-accent2">{r.score}</span><Link href={`/album/${r.targetMbid}`} className="truncate text-text2 hover:text-accent2">{r.label ?? r.targetMbid}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-2xl">Moje oceny artystów <span className="font-mono text-sm text-muted">{artistRatings.length}</span></h2>
          <ul className="mt-2 space-y-1 text-sm">
            {artistRatings.slice(0, 30).map((r) => (
              <li key={r.targetMbid} className="flex gap-2"><span className="w-8 font-mono text-accent2">{r.score}</span><Link href={`/artist/${r.targetMbid}`} className="truncate text-text2 hover:text-accent2">{r.label ?? r.targetMbid}</Link></li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
