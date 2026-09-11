import Link from "next/link";
import type { Dict } from "@/lib/dict";
import { fmt } from "@/lib/i18n";

/**
 * „Kliknąłem w płytę, a wylądowałem w wyszukiwarce."
 *
 * Tak to działało: gdy nie udało się dowiązać pozycji do MusicBrainz, przejście
 * kończyło się przekierowaniem na `/szukaj?q=artysta tytuł`. Z punktu widzenia
 * klikającego to najgorsze z możliwych zachowań — prosił o konkretną płytę,
 * a dostał pole wyszukiwania z tym samym pytaniem, na które portal właśnie
 * nie umiał odpowiedzieć.
 *
 * Teraz mówimy wprost, czego zabrakło, i dajemy dwa wyjścia: spróbować jeszcze
 * raz (bo najczęstsza przyczyna to chwilowa zadyszka MusicBrainz, nie brak
 * płyty) albo poszukać samemu. Nikt nie jest nigdzie wyrzucany bez ostrzeżenia.
 */
export function GoFail({ artist, album, retryHref, t }: { artist: string; album: string; retryHref: string; t: Dict }) {
  const szukaj = `/szukaj?q=${encodeURIComponent(`${artist} ${album}`.trim())}`;
  return (
    <div className="mx-auto mt-16 max-w-lg text-center">
      <p className="label mb-2">{t.common.goFailTitle}</p>
      <h1 className="text-3xl leading-tight">
        {artist} <span className="text-faint">–</span> <i>{album}</i>
      </h1>
      <p className="mt-4 text-sm text-muted">{fmt(t.common.goFailBody, { album })}</p>
      <p className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href={retryHref} className="btn btn-accent">{t.common.goFailRetry}</Link>
        <Link href={szukaj} className="chip">{t.common.goFailSearch}</Link>
      </p>
    </div>
  );
}
