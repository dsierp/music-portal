/**
 * „Ściągnij moje listy z Tidala" — bliźniak ekranu spotifajowego.
 *
 * Świadomie osobna strona, a nie wspólny ekran z przełącznikiem: to są dwa
 * różne konta, które podłącza się osobno, i każde może być niepodłączone
 * z innego powodu. Jeden ekran z dwoma stanami „nie masz konta" byłby
 * zagadką, a nie ułatwieniem.
 *
 * Czego tu NIE ma i nie będzie: dziennika odsłuchów. Tidal nie udostępnia
 * „co teraz gra" ani historii — to, co puszczasz z portalu w Tidala, i tak
 * zapisuje się przy kliknięciu, bez żadnego API.
 */
import Link from "next/link";
import type { Metadata } from "next";
import { currentUser } from "@/lib/auth";
import { i18n } from "@/lib/t";
import { fmt } from "@/lib/i18n";
import { connectTidal, podrozZPlaylistyTidal } from "@/app/actions";
import { tidalConfigured, tidalConnected, tidalPlaylisty } from "@/lib/tidal";

export const dynamic = "force-dynamic";
/** Dowiązywanie płyt do MusicBrainz idzie po sekundzie na płytę — patrz akcja. */
export const maxDuration = 60;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await i18n();
  return { title: t.lists.tidalImport };
}

export default async function ZTidala() {
  const { t } = await i18n();
  const user = await currentUser();
  if (!user) {
    return (
      <div className="card">
        <h1 className="text-2xl">{t.lists.tidalImport}</h1>
        <p className="mt-2 text-sm text-muted">{t.common.loginToDo}</p>
      </div>
    );
  }

  const gotowy = tidalConfigured();
  const podlaczone = gotowy ? await tidalConnected(user.id).catch(() => false) : false;
  const listy = podlaczone ? await tidalPlaylisty(user.id).catch(() => []) : [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl">{t.lists.tidalImport}</h1>
        <p className="mt-1 text-sm text-muted">{t.lists.tidalImportNote}</p>
      </header>

      {!gotowy || !podlaczone ? (
        <div className="card">
          <p className="text-sm text-muted">{t.lists.tidalNote}</p>
          {gotowy && (
            <form action={connectTidal.bind(null, "/podroze/z-tidala")} className="mt-2">
              <button className="btn btn-accent">{t.lists.tidalConnect}</button>
            </form>
          )}
        </div>
      ) : listy.length === 0 ? (
        <div className="card">
          <p className="text-sm text-muted">{t.lists.tidalImportEmpty}</p>
          <form action={connectTidal.bind(null, "/podroze/z-tidala")} className="mt-2">
            <button className="btn">{t.lists.tidalConnect}</button>
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
                <p className="mt-0.5 font-mono text-[10px] text-faint">{fmt(t.lists.spotifyImportTracks, { n: p.ile })}</p>
                <form action={podrozZPlaylistyTidal} className="mt-2">
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
