import Link from "next/link";
import { i18n } from "@/lib/t";
import { fmt } from "@/lib/i18n";

/**
 * MusicBrainz bywa chwilowo przeciążony (503). To nie jest błąd aplikacji ani
 * powód do straszenia stack trace'em — pokazujemy spokojny komunikat i drogę
 * dalej. Strona odświeży się sama po chwili, bo w 99% przypadków wystarczy
 * poczekać kilkanaście sekund.
 *
 * Używany tylko na stronach artysty i płyty (mojego wyrobu), więc może po
 * prostu sam sięgnąć po i18n() — nie trzeba przeciągać tłumaczeń przez propsy.
 */
export async function MbUnavailable({ what }: { what: string }) {
  const { t } = await i18n();
  return (
    <div className="py-16 text-center">
      <meta httpEquiv="refresh" content="15" />
      <h1 className="text-3xl">{t.common.mbUnavailableTitle}</h1>
      <p className="mx-auto mt-3 max-w-lg text-sm text-text2">{fmt(t.common.mbUnavailableBody, { what })}</p>
      <div className="mt-6 flex justify-center gap-2">
        <Link href="/premiery" className="btn">{t.nav.releases}</Link>
        <Link href="/" className="btn">{t.common.home}</Link>
      </div>
    </div>
  );
}
