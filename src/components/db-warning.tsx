import { i18n } from "@/lib/t";

/**
 * Pasek pokazywany, gdy lokalna baza nie odpowiada. Reszta strony (dane
 * z MusicBrainz/Wikipedii) działa normalnie — nie ma powodu jej ukrywać.
 *
 * Tylko na stronach artysty i płyty — woła i18n() sam, bez propsów.
 */
export async function DbWarning() {
  const { t } = await i18n();
  return (
    <div className="mb-4 rounded border border-red-500/40 bg-red-500/10 p-3 text-sm">
      <strong className="block">{t.common.dbWarningTitle}</strong>
      <span className="text-text2">
        {t.common.dbWarningDetails} {t.common.dbWarningIntro}{" "}
        <code className="font-mono text-accent2">npm run db:reset</code>, {t.common.dbWarningThen}{" "}
        <code className="font-mono text-accent2">npm run dev</code>.
      </span>
    </div>
  );
}
