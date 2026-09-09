import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { currentUser } from "@/lib/auth";
import { getAreas, getFavoriteArtists, getGenres, getLikedAlbums, getUserLocale, myRatings, usersCount } from "@/lib/user-data";
import { isAdmin } from "@/lib/admin";
import { addAreaAction, connectSpotify, removeAreaAction, setGenreAction, skipOnboarding, toggleFavorite, toggleLike } from "@/app/actions";
import { spotifyConfigured, spotifyConnected } from "@/lib/spotify";
import { MAIN_CATEGORIES } from "@/lib/genres";
import { orderByPopularity } from "@/lib/popularity";
import { genreImage } from "@/lib/genre-art";
import { Cover } from "@/components/cover";
import { LanguagePicker } from "@/components/language-picker";
import { i18n } from "@/lib/t";
import { fmt, plural } from "@/lib/i18n";
import { genreLabel } from "@/lib/dict";

/** Tytuł w zakładce też idzie w języku czytelnika. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await i18n();
  return { title: t.profile.profileLabel };
}
export const dynamic = "force-dynamic";

export default async function MePage({ searchParams }: { searchParams: Promise<{ witaj?: string }> }) {
  const witaj = (await searchParams).witaj === "1";
  const user = await currentUser();
  if (!user) redirect("/login?callbackUrl=/ja");
  const profileLocale = await getUserLocale(user.id).catch(() => null);
  const { locale, t } = await i18n(profileLocale);
  // Etykiety wag (1–5) trzymamy w słowniku profilu, nie w lib/genres.ts —
  // ten plik jest wspólny i nie tłumaczymy go tutaj.
  const weightLabels: Record<number, string> = {
    1: t.profile.weight1,
    2: t.profile.weight2,
    3: t.profile.weight3,
    4: t.profile.weight4,
    5: t.profile.weight5,
  };
  const [genres, liked, favs, albumRatings, artistRatings, areas, odrzuconePlyty, odrzuceniArtysci] = await Promise.all([
    getGenres(user.id), getLikedAlbums(user.id), getFavoriteArtists(user.id), myRatings(user.id, "ALBUM"), myRatings(user.id, "ARTIST"), getAreas(user.id),
    // „Nie moja bajka" — osobne listy, bo to nie to samo co niska ocena.
    getLikedAlbums(user.id, "dislike"), getFavoriteArtists(user.id, "dislike"),
  ]);
  const weightOf = new Map(genres.map((g) => [g.genre, g.weight]));
  // Statystyki tylko dla administratora — jedna liczba, więc pytamy o nią
  // dopiero wtedy, gdy jest komu ją pokazać.
  const admin = isAdmin(user.email);
  const ludzi = admin ? await usersCount().catch(() => null) : null;
  // Kafelki: najpierw to, co już masz (od największej wagi), potem reszta
  // według popularności wśród użytkowników portalu.
  const bySlug = new Map(MAIN_CATEGORIES.map((c) => [c.slug, c]));
  const mineFirst = genres.slice().sort((a, b) => b.weight - a.weight).map((g) => g.genre).filter((g) => bySlug.has(g));
  const restOrder = await orderByPopularity(MAIN_CATEGORIES.map((c) => c.slug).filter((s) => !mineFirst.includes(s)));
  const tiles = [...mineFirst, ...restOrder].map((slug) => bySlug.get(slug)!);
  const custom = genres.filter((g) => !MAIN_CATEGORIES.some((c) => c.slug === g.genre));
  // Spotify jest w pełni dobrowolne: bez kluczy w środowisku karta nie istnieje,
  // a bez kliknięcia użytkownika nie mamy do jego konta żadnego dostępu.
  const spotifyGotowy = spotifyConfigured();
  const spotifyJest = spotifyGotowy ? await spotifyConnected(user.id).catch(() => false) : false;

  return (
    <div className="space-y-10">
      {witaj && (
        <section className="card border-accent/60">
          <div className="label mb-1">{t.profile.welcomeEyebrow}</div>
          <h2 className="text-2xl">{t.profile.welcomeTitle}</h2>
          {/* Najpierw CO to za miejsce, dopiero potem prośba o gatunki — inaczej
              pierwszy ekran po zalogowaniu prosi o coś, zanim powie po co. */}
          <p className="mt-2 max-w-2xl text-sm text-text2">
            {t.about.onboardingBody}{" "}
            <Link href="/o-portalu" className="underline hover:text-accent2">{t.about.onboardingMore}</Link>
          </p>
          <p className="mt-2 max-w-2xl text-sm text-text2">{t.profile.welcomeBody}</p>
          <form action={skipOnboarding} className="mt-3">
            <button className="text-xs text-muted underline hover:text-accent2">{t.profile.chooseLater}</button>
          </form>
        </section>
      )}
      {spotifyGotowy && (
        <section className="card">
          <h2 className="text-xl">Spotify</h2>
          <p className="mt-1 text-xs text-muted">{t.profile.spotifyNote}</p>
          {spotifyJest ? (
            <p className="mt-2 text-sm text-ok">{t.profile.spotifyConnected}</p>
          ) : (
            <form action={connectSpotify.bind(null, "/ja")} className="mt-2">
              <button className="btn btn-accent">{t.lists.spotifyConnect}</button>
            </form>
          )}
        </section>
      )}

      <header>
        <div className="label">{t.profile.profileLabel}</div>
        <h1 className="text-4xl">{user.name || user.email}</h1>
        <p className="text-sm text-muted">{user.email}</p>
      </header>

      {admin && ludzi !== null && (
        <section id="statystyki" className="card">
          <h2 className="text-2xl">{t.profile.statsTitle}</h2>
          <p className="mt-2 font-mono text-3xl text-accent2">{plural(locale, ludzi, t.profile.statsUsers)}</p>
          <p className="mt-1 text-xs text-faint">{t.profile.statsExplain}</p>
        </section>
      )}

      <section id="jezyk">
        <h2 className="text-2xl">{t.profile.languageTitle}</h2>
        <p className="mb-3 text-sm text-muted">{t.profile.languageExplain}</p>
        <LanguagePicker locale={locale} label={t.nav.language} />
      </section>

      <section id="obszary">
        <h2 className="text-2xl">{t.profile.areasTitle}</h2>
        <p className="mb-4 text-sm text-muted">
          {t.profile.areasIntro1}{" "}
          <Link href="/koncerty" className="underline">{t.profile.areasIntroLink}</Link> {t.profile.areasIntro2}
        </p>
        <div className="grid gap-6 sm:grid-cols-2">
          {([
            { scope: "genres" as const, title: t.profile.genresScopeTitle, hint: t.profile.genresScopeHint },
            { scope: "favorites" as const, title: t.profile.favoritesScopeTitle, hint: t.profile.favoritesScopeHint },
          ]).map(({ scope, title, hint }) => {
            const list = areas.filter((a) => a.scope === scope);
            return (
              <div key={scope} className="card">
                <div className="label mb-2">{title}</div>
                {list.length > 0 ? (
                  <ul className="mb-3 flex flex-wrap gap-2">
                    {list.map((a) => (
                      <li key={`${a.country}-${a.city ?? ""}`}>
                        <form action={removeAreaAction} className="flex items-center gap-1">
                          <input type="hidden" name="scope" value={scope} />
                          <input type="hidden" name="country" value={a.country} />
                          <input type="hidden" name="city" value={a.city ?? ""} />
                          <span className="chip chip-on">{a.city ? `${a.city} · ${a.country}` : fmt(t.profile.wholeCountry, { country: a.country })}</span>
                          <button className="text-xs text-muted hover:text-accent2" title={t.profile.removeAreaTitle}>×</button>
                        </form>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mb-3 text-xs text-muted">{fmt(t.profile.noAreaChosen, { hint })}</p>
                )}
                <form action={addAreaAction} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="scope" value={scope} />
                  <label className="text-xs text-muted">
                    <span className="label block">{t.profile.cityLabel}</span>
                    <input name="city" placeholder={t.profile.cityPlaceholder} className="input w-44 py-1 text-sm" autoComplete="off" />
                  </label>
                  <label className="text-xs text-muted">
                    <span className="label block">{t.profile.countryLabel}</span>
                    <input name="country" maxLength={2} defaultValue="PL" className="input w-16 py-1 text-sm uppercase" autoComplete="off" />
                  </label>
                  <button className="btn">{t.profile.addButton}</button>
                </form>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-faint">{t.profile.areaFootnote}</p>
      </section>

      <section id="style">
        <h2 className="text-2xl">{t.profile.stylesTitle}</h2>
        <p className="mb-4 text-sm text-muted">{t.profile.stylesIntro}</p>
        {genres.length > 0 && (
          <div className="card mb-4">
            <div className="label mb-2">{t.profile.yourStyles}</div>
            <ul className="space-y-2">
              {genres.map((g) => (
                <li key={g.genre} className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="w-56 font-medium">{g.genre}</span>
                  <form action={setGenreAction} className="flex items-center gap-1">
                    <input type="hidden" name="genre" value={g.genre} />
                    {[1, 2, 3, 4, 5].map((w) => (
                      <button key={w} name="weight" value={w} title={weightLabels[w]} className={`h-7 w-7 rounded border font-mono text-xs ${g.weight === w ? "border-accent bg-accent text-white" : "border-rule bg-surface2 hover:border-accent"}`}>{w}</button>
                    ))}
                    <span className="ml-2 text-xs text-muted">{weightLabels[g.weight]}</span>
                    <button name="weight" value="0" className="ml-3 text-xs text-muted hover:text-accent2">{t.profile.removeWeight}</button>
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
                    <span className="display block text-lg leading-tight">{genreLabel(c.slug, t, c.label)}</span>
                    <span className="font-mono text-[10px] text-muted">
                      {on ? fmt(t.profile.tileOnHint, { w: weightOf.get(c.slug)! }) : t.profile.tileAddHint}
                    </span>
                  </span>
                </button>
              </form>
            );
          })}
        </div>
        {custom.length > 0 && (
          <div className="mt-4">
            <div className="label mb-1">{t.profile.customGenresTitle}</div>
            <div className="flex flex-wrap gap-1.5">
              {custom.map((c) => (
                <form key={c.genre} action={setGenreAction}>
                  <input type="hidden" name="genre" value={c.genre} />
                  <input type="hidden" name="weight" value="0" />
                  <button className="chip" title={t.profile.removeCustomGenreTitle}>{c.genre} ✕</button>
                </form>
              ))}
            </div>
            <p className="mt-1 text-xs text-faint">{t.profile.customGenresFootnote}</p>
          </div>
        )}
      </section>

      <section id="plyty">
        <div className="flex items-baseline justify-between">
          <h2 className="text-2xl">{t.profile.likedAlbumsTitle} <span className="font-mono text-sm text-muted">{liked.length}</span></h2>
          <Link href="/szukaj?lubie=1" className="btn">{t.profile.addAlbum}</Link>
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
                  <input type="hidden" name="current" value="like" />
                  <input type="hidden" name="kind" value="like" />
                  <button className="text-xs text-muted hover:text-accent2">{t.profile.removeAlbum}</button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">{t.profile.noLikedAlbums}</p>
        )}
      </section>

      <section id="artysci">
        <h2 className="text-2xl">{t.profile.favoriteArtistsTitle} <span className="font-mono text-sm text-muted">{favs.length}</span></h2>
        {favs.length ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {favs.map((f) => (
              <li key={f.mbid} className="flex items-center gap-2 rounded border border-rule bg-surface px-3 py-1 text-sm">
                <Link href={`/artist/${f.mbid}`} className="hover:text-accent2">{f.name}</Link>
                <form action={toggleFavorite}>
                  <input type="hidden" name="mbid" value={f.mbid} />
                  <input type="hidden" name="current" value="like" />
                  <input type="hidden" name="kind" value="like" />
                  <input type="hidden" name="name" value={f.name} />
                  <button className="text-xs text-muted hover:text-accent2">×</button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">{t.profile.noFavoriteArtists}</p>
        )}
      </section>

      {(odrzuconePlyty.length > 0 || odrzuceniArtysci.length > 0) && (
        <section id="nie-moja-bajka">
          <h2 className="text-2xl">{t.profile.dislikedTitle}</h2>
          <p className="mb-3 text-sm text-muted">{t.profile.dislikedExplain}</p>
          {odrzuconePlyty.length > 0 && (
            <ul className="grid gap-2 sm:grid-cols-2">
              {odrzuconePlyty.map((a) => (
                <li key={a.mbid} className="flex items-center gap-3 rounded border border-rule bg-surface p-2 text-sm opacity-70">
                  <Cover mbid={a.mbid} size={40} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/album/${a.mbid}`} className="block truncate font-medium hover:text-accent2">{a.title}</Link>
                    <div className="truncate text-xs text-muted">{a.artistName}</div>
                  </div>
                  <form action={toggleLike}>
                    <input type="hidden" name="mbid" value={a.mbid} />
                    <input type="hidden" name="current" value="dislike" />
                    <input type="hidden" name="kind" value="dislike" />
                    <button className="text-xs text-muted hover:text-accent2">{t.profile.undislike}</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          {odrzuceniArtysci.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {odrzuceniArtysci.map((f) => (
                <li key={f.mbid} className="flex items-center gap-2 rounded border border-rule bg-surface px-3 py-1 text-sm opacity-70">
                  <Link href={`/artist/${f.mbid}`} className="hover:text-accent2">{f.name}</Link>
                  <form action={toggleFavorite}>
                    <input type="hidden" name="mbid" value={f.mbid} />
                    <input type="hidden" name="current" value="dislike" />
                    <input type="hidden" name="kind" value="dislike" />
                    <input type="hidden" name="name" value={f.name} />
                    <button className="text-xs text-muted hover:text-accent2">×</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section id="oceny" className="grid gap-6 sm:grid-cols-2">
        <div>
          <h2 className="text-2xl">{t.profile.myAlbumRatings} <span className="font-mono text-sm text-muted">{albumRatings.length}</span></h2>
          <ul className="mt-2 space-y-1 text-sm">
            {albumRatings.slice(0, 30).map((r) => (
              <li key={r.targetMbid} className="flex gap-2"><span className="w-8 font-mono text-accent2">{r.score}</span><Link href={`/album/${r.targetMbid}`} className="truncate text-text2 hover:text-accent2">{r.label ?? r.targetMbid}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-2xl">{t.profile.myArtistRatings} <span className="font-mono text-sm text-muted">{artistRatings.length}</span></h2>
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
