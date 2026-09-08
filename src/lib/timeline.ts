/**
 * Scalanie członkostw w wiersze osi czasu.
 *
 * MusicBrainz trzyma każde wejście do składu jako osobną relację: Tony Choy
 * odchodził i wracał do Atheist, więc ma ich cztery. Na wykresie to wciąż jeden
 * basista — jeden wiersz, kilka pasków, przerwy widoczne jako luki.
 *
 * Osobny plik (a nie środek komponentu), żeby dało się to przetestować bez
 * renderowania Reacta — to jest to miejsce, w którym błąd był widoczny gołym
 * okiem, a i tak przeszedł.
 */
export interface TimelineSpan {
  begin: string | null;
  end: string | null;
  current: boolean;
  roles: string[];
}
export interface TimelineRow<M> {
  mbid: string;
  name: string;
  spans: TimelineSpan[];
  marks: M[];
}
interface MembershipLike {
  mbid: string;
  name: string;
  roles: string[];
  begin: string | null;
  end: string | null;
  current: boolean;
}

/**
 * Jeden wiersz na MBID. Odcinki w wierszu rosnąco po dacie wejścia,
 * wiersze — kto zaczął wcześniej, ten wyżej.
 */
export function mergeSpans<T extends MembershipLike, M = never>(
  items: T[],
  marksFor?: (m: T) => M[],
): TimelineRow<M>[] {
  const map = new Map<string, TimelineRow<M>>();
  for (const m of items) {
    const row = map.get(m.mbid) ?? { mbid: m.mbid, name: m.name, spans: [], marks: marksFor?.(m) ?? [] };
    row.spans.push({ begin: m.begin, end: m.end, current: m.current, roles: m.roles });
    map.set(m.mbid, row);
  }
  for (const row of map.values()) {
    row.spans.sort((a, b) => (a.begin ?? "").localeCompare(b.begin ?? ""));
  }
  return [...map.values()].sort((a, b) => {
    const ab = a.spans[0]?.begin ?? "9999";
    const bb = b.spans[0]?.begin ?? "9999";
    return ab.localeCompare(bb) || a.name.localeCompare(b.name, "pl");
  });
}

/** Wszystkie instrumenty wiersza — do koloru paska i legendy. */
export function rowRoles(row: { spans: TimelineSpan[] }): string[] {
  const out: string[] = [];
  for (const s of row.spans) for (const r of s.roles) if (!out.includes(r)) out.push(r);
  return out;
}
