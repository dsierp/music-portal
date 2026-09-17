import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getLikedAlbums, getUserLocale } from "@/lib/user-data";
import { ostatnieOdsluchy, ostatniePlyty, wCzymSiedzialem } from "@/lib/grane";
import { podrozZGranych } from "@/app/actions";
import { i18n } from "@/lib/t";
import { fmt, formatDate } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await i18n();
  return { title: t.lists.playedTitle };
}
export const dynamic = "force-dynamic";
/** Robienie podróży z dziennika dowiązuje płyty w MusicBrainz — po jednej na sekundę. */
export const maxDuration = 60;

/**
 * „Co grałem" — dziennik odsłuchań i trzy rzeczy, które da się z niego zrobić.
 *
 * To NIE jest lista życzeń ani podróż: tamte są decyzją, a to jest faktem.
 * Wartość jest w tym, że fakty da się potem wykorzystać — „zrób z tego podróż",
 * „poszukaj czegoś w tym klimacie" — bez proszenia człowieka, żeby cokolwiek
 * wpisywał. On już to zrobił, słuchając.
 */
export default async function GranePage() {
  const user = await currentUser();
  if (!user) redirect("/login?callbackUrl=/grane");
  const { locale, t } = await i18n(await getUserLocale(user.id).catch(() => null));

  // Dwie listy, nie jedna: to, co człowiek puścił STĄD (ślad po portalu), i to,
  // co portal podejrzał w Spotify (cudze, choć jego). Mieszane wyglądały jak
  // jeden dziennik, w którym nie wiadomo, co się z czego wzięło.
  const [odsluchy, zeSpotify, plyty, topki, lubiane] = await Promise.all([
    ostatnieOdsluchy(user.id, 60, "klik").catch(() => []),
    ostatnieOdsluchy(user.id, 30, "spotify").catch(() => []),
    ostatniePlyty(user.id).catch(() => []),
    wCzymSiedzialem(user.id).catch(() => []),
    getLikedAlbums(user.id).catch(() => []),
  ]);

  const kto = topki.map((x) => x.artist).slice(0, 6).join(", ");
  const lubie = lubiane.slice(0, 8).map((a) => `${a.artistName} – ${a.title}`).join(", ");

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <div className="label">{t.lists.playedFrom}</div>
        <h1 className="text-4xl">{t.lists.playedTitle}</h1>
        <p className="mt-2 max-w-2xl text-sm text-text2">{t.lists.playedIntro}</p>
      </header>

      {!odsluchy.length && !zeSpotify.length ? (
        <p className="card text-sm text-muted">{t.lists.playedEmpty}</p>
      ) : (
        <>
          {topki.length > 0 && (
            <section className="card">
              <h2 className="label mb-2">{t.lists.playedTop}</h2>
              <ul className="flex flex-wrap gap-2">
                {topki.map((x) => (
                  <li key={x.artist} className="chip">
                    {x.artist} <span className="text-faint">· {x.ile}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Trzy wyjścia z dziennika. Pierwsze robi rzecz z tego, co było;
              dwa kolejne prowadzą do szukania — z gotowym poleceniem, bo
              człowiek nie ma go po raz kolejny wymyślać. */}
          <section className="space-y-3">
            {plyty.length > 0 && (
              <form action={podrozZGranych}>
                <button className="btn btn-accent">{t.lists.playedAgain}</button>
                <p className="mt-1 text-xs text-faint">{t.lists.playedAgainNote}</p>
              </form>
            )}
            <div className="flex flex-wrap gap-3">
              {kto && (
                <Link href={`/rozmowa?opis=${encodeURIComponent(fmt(t.lists.playedPrompt, { kto }))}`} className="btn">
                  {t.lists.playedSimilar}
                </Link>
              )}
              {lubie && (
                <Link href={`/rozmowa?opis=${encodeURIComponent(fmt(t.lists.playedPrompt, { kto: lubie }))}`} className="btn">
                  {t.lists.playedLiked}
                </Link>
              )}
            </div>
          </section>

          {odsluchy.length > 0 && (
            <section>
              <h2 className="label mb-2">{t.lists.playedPortal}</h2>
              <Dziennik wiersze={odsluchy} locale={locale} />
            </section>
          )}

          {zeSpotify.length > 0 && (
            <section>
              <h2 className="label mb-1">{t.lists.playedSpotify}</h2>
              <p className="mb-2 text-xs text-faint">{t.lists.playedSpotifyNote}</p>
              <Dziennik wiersze={zeSpotify} locale={locale} />
            </section>
          )}
        </>
      )}
    </div>
  );
}

/** Jeden wiersz dziennika. Ten sam kształt dla obu list — różni je tylko nagłówek. */
function Dziennik({
  wiersze,
  locale,
}: {
  wiersze: Awaited<ReturnType<typeof ostatnieOdsluchy>>;
  locale: Parameters<typeof formatDate>[1];
}) {
  return (
    <ul className="divide-y divide-rule">
      {wiersze.map((o) => (
        <li key={o.id} className="flex items-baseline justify-between gap-3 py-2">
          <div className="min-w-0">
            <div className="truncate text-sm">
              {o.mbid ? (
                <Link href={`/album/${o.mbid}`} className="hover:text-accent2">{o.title}</Link>
              ) : (
                o.title
              )}
            </div>
            <div className="truncate text-xs text-muted">
              {o.artist}
              {o.album && o.album !== o.title ? ` · ${o.album}` : ""}
            </div>
          </div>
          <span className="shrink-0 font-mono text-[10px] text-faint">
            {formatDate(o.playedAt.toISOString().slice(0, 10), locale)}
          </span>
        </li>
      ))}
    </ul>
  );
}
