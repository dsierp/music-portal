"use client";
import Link from "next/link";

/**
 * Globalny ekran błędu. Rozpoznaje dwie awarie, które w tym portalu zdarzają
 * się realnie, i mówi wprost, co zrobić — zamiast pokazywać zapytanie SQL
 * albo stack trace, z których nic nie wynika.
 */
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  const msg = error.message ?? "";
  const dbDown = /Failed query|database|PGlite|relation .* does not exist/i.test(msg);
  const mbDown = /MusicBrainz|503/i.test(msg);

  if (dbDown) {
    return (
      <Shell title="Lokalna baza nie odpowiada" reset={reset}>
        <p>
          Oceny, komentarze, premiery i best of są chwilowo niedostępne — to dane z lokalnej bazy.
          Najczęstsza przyczyna: serwer został ubity w trakcie zapisu albo dwa procesy pisały naraz.
        </p>
        <p className="mt-2">
          Naprawa: zatrzymaj serwer (<b>Ctrl+C</b>, nie Ctrl+Z), potem{" "}
          <code className="font-mono text-accent2">npm run db:reset</code> i{" "}
          <code className="font-mono text-accent2">npm run dev</code>.
        </p>
      </Shell>
    );
  }
  if (mbDown) {
    return (
      <Shell title="MusicBrainz chwilowo nie odpowiada" reset={reset}>
        <p>
          MusicBrainz ogranicza liczbę zapytań (1 na sekundę) i czasem bywa przeciążony. To mija samo —
          spróbuj ponownie za kilkanaście sekund. Dane, które już raz pobraliśmy, siedzą w cache’u i działają dalej.
        </p>
      </Shell>
    );
  }
  return (
    <Shell title="Coś poszło nie tak" reset={reset}>
      <p className="font-mono text-xs text-faint">{msg}</p>
    </Shell>
  );
}

function Shell({ title, children, reset }: { title: string; children: React.ReactNode; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <h1 className="text-3xl">{title}</h1>
      <div className="mt-3 text-sm text-text2">{children}</div>
      <div className="mt-6 flex justify-center gap-2">
        <button onClick={reset} className="btn btn-accent">Spróbuj ponownie</button>
        <Link href="/" className="btn">Strona główna</Link>
      </div>
    </div>
  );
}
