/**
 * Pokazuje się automatycznie, gdy strona czeka na dane (najczęściej z MusicBrainz —
 * limit 1 zapytanie/sekundę, więc strona płyty czy artysty potrafi wczytywać się kilka sekund).
 */
import { i18n } from "@/lib/t";

export default async function Loading() {
  const { t } = await i18n();
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-rule border-t-accent" />
      <div>
        <p className="text-text2">{t.search.loadingData}</p>
        <p className="mt-1 text-xs text-faint">{t.search.loadingHint}</p>
      </div>
    </div>
  );
}
