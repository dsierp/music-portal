/**
 * Okno tygodnia i budowa zapytania do MusicBrainz — czyste funkcje, bez sieci
 * i bez bazy, żeby dało się je testować bez uruchamiania PGlite.
 */
export interface WeekWindow {
  /** poniedziałek–niedziela tygodnia, w którym wypada dany piątek (YYYY-MM-DD) */
  from: string;
  to: string;
  /** piątek tego tygodnia — identyfikuje zestawienie */
  friday: string;
}

/** Okno tygodnia dla piątku, w którym wypada `date` (domyślnie: najbliższy miniony piątek). */
export function weekOf(date = new Date()): WeekWindow {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // 5 = piątek; cofamy się do ostatniego piątku (dziś, jeśli jest piątek)
  const back = (d.getUTCDay() - 5 + 7) % 7;
  const friday = new Date(d);
  friday.setUTCDate(d.getUTCDate() - back);
  const to = new Date(friday);
  to.setUTCDate(friday.getUTCDate() + 6);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  return { from: iso(friday), to: iso(to), friday: iso(friday) };
}

/** Zapytanie do wyszukiwarki MB — wydzielone, żeby dało się je przetestować bez sieci. */
export function releaseQuery(tag: string, week: WeekWindow): string {
  const safe = tag.replace(/["\\]/g, " ").trim();
  return `tag:"${safe}" AND firstreleasedate:[${week.from} TO ${week.to}] AND primarytype:album AND status:official`;
}

