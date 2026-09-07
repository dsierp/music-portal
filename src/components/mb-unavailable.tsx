import Link from "next/link";

/**
 * MusicBrainz bywa chwilowo przeciążony (503). To nie jest błąd aplikacji ani
 * powód do straszenia stack trace'em — pokazujemy spokojny komunikat i drogę
 * dalej. Strona odświeży się sama po chwili, bo w 99% przypadków wystarczy
 * poczekać kilkanaście sekund.
 */
export function MbUnavailable({ what }: { what: string }) {
  return (
    <div className="py-16 text-center">
      <meta httpEquiv="refresh" content="15" />
      <h1 className="text-3xl">MusicBrainz chwilowo nie odpowiada</h1>
      <p className="mx-auto mt-3 max-w-lg text-sm text-text2">
        Nie udało się pobrać danych ({what}). MusicBrainz ogranicza liczbę zapytań i czasem bywa przeciążony —
        to mija samo. Ta strona spróbuje ponownie za 15 sekund.
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <Link href="/premiery" className="btn">Premiery</Link>
        <Link href="/" className="btn">Strona główna</Link>
      </div>
    </div>
  );
}
