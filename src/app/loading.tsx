/**
 * Pokazuje się automatycznie, gdy strona czeka na dane (najczęściej z MusicBrainz —
 * limit 1 zapytanie/sekundę, więc strona płyty czy artysty potrafi wczytywać się kilka sekund).
 */
export default function Loading() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-rule border-t-accent" />
      <div>
        <p className="text-text2">Wczytuję dane…</p>
        <p className="mt-1 text-xs text-faint">MusicBrainz i Wikipedia — czasem chwilę to trwa.</p>
      </div>
    </div>
  );
}
