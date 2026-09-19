/**
 * „Ściągnij moje listy ze Spotify".
 *
 * Playlisty w Spotify są utworami, portal chodzi wokół płyt — więc tu nie
 * kopiujemy listy jeden do jednego, tylko wyciągamy z niej ALBUMY i robimy
 * z nich podróż: coś, co da się odhaczać, komentować i w co da się wejść.
 *
 * Nic nie dzieje się samo: widać, co jest na koncie, a ściąga się to, co
 * człowiek kliknie. Żadnej synchronizacji w tle — portal nie jest kopią
 * Spotify, tylko innym sposobem patrzenia na to samo.
 */
import Link from "next/link";
import type { Metadata } from "next";
import { currentUser } from "@/lib/auth";
import { i18n } from "@/lib/t";
import { fmt } from "@/lib/i18n";
import { connectSpotify, podrozZPlaylisty } from "@/app/actions";
import { spotifyConfigured, spotifyConnected, spotifyPlaylisty } from "@/lib/spotify";

export const dynamic = "force-dynamic";
/** Dowiązywanie płyt do MusicBrainz idzie po sekundzie na płytę — patrz akcja. */
export const maxDuration = 60;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await i18n();
  return { title: t.lists.spotifyImport };
}

export default async function ZeSpotify() {
  const { t } = await i18n();
  const user = await currentUser();
  if (!user) {
    return (
      <div className="card">
        <h1 className="text-2xl">{t.lists.spotifyImport}</h1>
        <p className="mt-2 text-sm text-muted">{t.common.loginToDo}</p>
      </div>
    );
  }

  const gotowy = spotifyConfigured();
  const podlaczone = gotowy ? await spotifyConnected(user.id).catch(() => false) : false;
  const listy = podlaczone ? await spotifyPlaylisty(user.id).catch(() => []) : [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl">{t.lists.spotifyImport}</h1>
        <p className="mt-1 text-sm text-muted">{t.lists.spotifyImportNote}</p>
      </header>

      {!gotowy || !podlaczone ? (
        <div className="card">
          <p className="text-sm text-muted">{t.profile.spotifyNote}</p>
          {gotowy && (
            <form action={connectSpotify.bind(null, "/podroze/ze-spotify")} className="mt-2">
              <button className="btn btn-accent">{t.lists.spotifyConnect}</button>
            </form>
          )}
        </div>
      ) : listy.length === 0 ? (
        // Pusto może znaczyć dwie rzeczy i obie trzeba powiedzieć wprost:
        // albo naprawdę nie ma playlist, albo konto podłączono, zanim portal
        // zaczął prosić o zgodę na ich odczyt.
        <div className="card">
          <p className="text-sm text-muted">{t.lists.spotifyImportEmpty}</p>
          <form action={connectSpotify.bind(null, "/podroze/ze-spotify")} className="mt-2">
            <button className="btn">{t.lists.spotifyImportReconnect}</button>
          </form>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {listy.map((p) => (
            <li key={p.id} className="card flex gap-3">
              {p.okladka ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.okladka} alt="" className="h-16 w-16 shrink-0 rounded object-cover" loading="lazy" />
              ) : (
                <div className="h-16 w-16 shrink-0 rounded bg-surface2" />
              )}
              <div className="min-w-0 flex-1">
                <a href={p.url} target="_blank" rel="noopener" className="block truncate hover:text-accent2">
                  {p.nazwa}
                </a>
                <p className="mt-0.5 font-mono text-[10px] text-faint">
                  {fmt(t.lists.spotifyImportTracks, { n: p.ile })}
                  {!p.moja && p.czyja ? ` · ${p.czyja}` : ""}
                </p>
                <form action={podrozZPlaylisty} className="mt-2">
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="nazwa" value={p.nazwa} />
                  <button className="btn">{t.lists.spotifyImportGrab}</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-sm">
        <Link href="/podroze" className="text-muted hover:text-accent2">
          ← {t.nav.lists}
        </Link>
      </p>
    </div>
  );
}
