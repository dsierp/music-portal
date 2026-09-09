/**
 * Dziennik podróży — jedna oś czasu z tego, co człowiek tu porobił.
 *
 * Portal zapisuje ślady w pięciu miejscach (przystanki, założone podróże,
 * polubione płyty, ulubieni artyści, oceny, komentarze, polecenia od innych),
 * a każde z nich osobno jest nudną listą. Razem, w kolejności odwrotnej do
 * dziejów, robi się z tego zapis wędrówki: „w środę dopisałem Bolt Thrower do
 * »Do posłuchania«, w czwartek oceniłem go na 9".
 *
 * Ten plik jest CZYSTY (żadnej bazy, żadnego React-a) — zdarzenia zbiera
 * `travelJournal` w user-data, a tu je tylko scalamy i grupujemy po dniach,
 * żeby dało się to przetestować bez bazy.
 */

export type JournalKind = "stop" | "journey" | "album" | "artist" | "rating" | "comment" | "shared";

export interface JournalEvent {
  at: Date;
  kind: JournalKind;
  /** Co: tytuł płyty, nazwa zespołu, nazwa podróży, początek komentarza. */
  title: string;
  href: string | null;
  /** Dokąd to trafiło albo od kogo przyszło — np. nazwa podróży. */
  context: string | null;
  contextHref: string | null;
  /** „lubię" / „nie moja bajka" — tam, gdzie zdarzenie ma znak. */
  sentiment: "like" | "dislike" | null;
  score: number | null;
}

/**
 * Scalenie strumieni w jedną oś.
 *
 * Odsiewamy duplikaty (to samo zdarzenie o tym samym czasie potrafi przyjść
 * dwiema drogami — np. dopisanie przystanku odświeża podróż) i tniemy do
 * `limit`, bo dziennik na stronie głównej ma być zajawką, nie archiwum.
 */
export function scalDziennik(strumienie: JournalEvent[][], limit = 12): JournalEvent[] {
  const wszystkie = strumienie.flat().filter((e) => e.at instanceof Date && !Number.isNaN(e.at.getTime()));
  wszystkie.sort((a, b) => b.at.getTime() - a.at.getTime());
  const widziane = new Set<string>();
  const out: JournalEvent[] = [];
  for (const e of wszystkie) {
    const klucz = `${e.kind}|${e.href ?? e.title}|${Math.floor(e.at.getTime() / 1000)}`;
    if (widziane.has(klucz)) continue;
    widziane.add(klucz);
    out.push(e);
    if (out.length >= limit) break;
  }
  return out;
}

/** Dzień jako YYYY-MM-DD w czasie lokalnym przeglądarki serwera — do grupowania. */
export function dzien(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Zdarzenia pogrupowane po dniach, dni od najnowszego. */
export function poDniach(events: JournalEvent[]): { day: string; events: JournalEvent[] }[] {
  const mapa = new Map<string, JournalEvent[]>();
  for (const e of events) {
    const k = dzien(e.at);
    const lista = mapa.get(k);
    if (lista) lista.push(e);
    else mapa.set(k, [e]);
  }
  return [...mapa.entries()].map(([day, evs]) => ({ day, events: evs }));
}
