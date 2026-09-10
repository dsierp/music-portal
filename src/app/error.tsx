"use client";
import Link from "next/link";

/**
 * Globalny ekran błędu. Rozpoznaje dwie awarie, które w tym portalu zdarzają
 * się realnie, i mówi wprost, co zrobić — zamiast pokazywać zapytanie SQL
 * albo stack trace, z których nic nie wynika.
 *
 * DECYZJA O JĘZYKU: to komponent kliencki ("use client" — Next.js wymaga tego
 * od error boundary), więc nie może wywołać i18n()/cookies() jak reszta
 * ekranów (to funkcje tylko-serwerowe). Owijanie tego w osobny serwerowy
 * komponent tylko po to, żeby przekazać cztery gotowe napisy przez propsy,
 * dokłada plik i pośredni stan bez realnej korzyści — błąd i tak trzeba
 * zrozumieć od razu, awaryjnie, więc zamiast zgadywać język (bez dostępu do
 * ciasteczka) zostawiamy tu tekst dwujęzyczny PL/EN. To jedyny ekran w portalu
 * z takim wyjątkiem.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const msg = error.message ?? "";
  const dbDown = /Failed query|database|PGlite|relation .* does not exist/i.test(msg);
  const mbDown = /MusicBrainz|503/i.test(msg);

  if (dbDown) {
    return (
      <Shell title="Lokalna baza nie odpowiada / Local database not responding" reset={reset}>
        <p>
          Oceny, komentarze, premiery i best of są chwilowo niedostępne — to dane z lokalnej bazy.
          Najczęstsza przyczyna: serwer został ubity w trakcie zapisu albo dwa procesy pisały naraz.
        </p>
        <p className="mt-2">
          Naprawa: zatrzymaj serwer (<b>Ctrl+C</b>, nie Ctrl+Z), potem{" "}
          <code className="font-mono text-accent2">npm run db:reset</code> i{" "}
          <code className="font-mono text-accent2">npm run dev</code>.
        </p>
        <p className="mt-4 text-faint">
          Ratings, comments, new releases and best-of are temporarily unavailable — this is local-database data.
          Usual cause: the server was killed mid-write, or two processes wrote at once. Fix: stop the server
          (<b>Ctrl+C</b>, not Ctrl+Z), then <code className="font-mono text-accent2">npm run db:reset</code> and{" "}
          <code className="font-mono text-accent2">npm run dev</code>.
        </p>
      </Shell>
    );
  }
  if (mbDown) {
    return (
      <Shell title="MusicBrainz chwilowo nie odpowiada / MusicBrainz not responding" reset={reset}>
        <p>
          MusicBrainz ogranicza liczbę zapytań (1 na sekundę) i czasem bywa przeciążony. To mija samo —
          spróbuj ponownie za kilkanaście sekund. Dane, które już raz pobraliśmy, siedzą w cache’u i działają dalej.
        </p>
        <p className="mt-4 text-faint">
          MusicBrainz limits requests to one per second and is sometimes overloaded. It passes on its own —
          try again in a few seconds. Data we already fetched sits in the cache and keeps working.
        </p>
      </Shell>
    );
  }
  return (
    <Shell title="Coś poszło nie tak / Something went wrong" reset={reset}>
      <p className="font-mono text-xs text-faint">{msg}</p>
      {/* Na produkcji Next.js wycina treść błędu i zostawia sam `digest` —
          bez niego w logach nie da się znaleźć TEGO wystąpienia. Sam skrót nic
          nie zdradza, a pozwala dopasować zgłoszenie do wpisu w logu. */}
      {error.digest && (
        <p className="mt-3 font-mono text-[10px] text-faint">
          kod / code: {error.digest}
        </p>
      )}
    </Shell>
  );
}

function Shell({ title, children, reset }: { title: string; children: React.ReactNode; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <h1 className="text-3xl">{title}</h1>
      <div className="mt-3 text-sm text-text2">{children}</div>
      <div className="mt-6 flex justify-center gap-2">
        <button onClick={reset} className="btn btn-accent">Spróbuj ponownie / Try again</button>
        <Link href="/" className="btn">Strona główna / Home</Link>
      </div>
    </div>
  );
}
