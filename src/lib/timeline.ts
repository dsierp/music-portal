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
  /**
   * true = okres odczytany z płyt, nie z dat członkostwa. MusicBrainz nagminnie
   * nie ma dat przy członkostwie (Inferno siedzi w Behemocie od 1997, a relacja
   * jest goła) — wtedy zamiast chować wiersz albo rysować pasek przez całą
   * szerokość, bierzemy pierwszą i ostatnią płytę tego zespołu i mówimy wprost,
   * skąd te daty.
   */
  inferred?: boolean;
  /**
   * true = nie wiemy nic: ani MusicBrainz, ani Wikidane, ani płyty. Wiersz i tak
   * zostaje (informacja „grał tam" jest prawdziwa i cenna), tylko pasek idzie
   * przez całą oś linią przerywaną i podpisem „?–?". Serwisy bywają dziurawe;
   * chowanie przed czytelnikiem tego, co wiemy, jest gorsze niż uczciwe „?".
   */
  unknown?: boolean;
  /** daty dobrane z Wikidanych, bo MusicBrainz ich nie miał */
  fromWikidata?: boolean;
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
  datesFrom?: "wikidata";
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
    row.spans.push({ begin: m.begin, end: m.end, current: m.current, roles: m.roles, fromWikidata: m.datesFrom === "wikidata" });
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

/**
 * Uzupełnia wiersze bez dat okresem odczytanym ze znaczników (płyt zespołu).
 *
 * Bez tego strona muzyka bywała pusta: MusicBrainz często nie ma dat przy
 * członkostwie, a wiersz bez dat albo znikał, albo rysował się przez całą oś —
 * obie odpowiedzi są nieprawdziwe. Wiersze, których nie da się umiejscowić
 * (brak dat i brak płyt), odpadają: nie ma czego rysować.
 */
export function fillMissingSpans<M extends { date: string | null }>(rows: TimelineRow<M>[]): TimelineRow<M>[] {
  const out: TimelineRow<M>[] = [];
  for (const row of rows) {
    const dated = row.spans.some((s) => s.begin || s.end);
    if (dated) {
      out.push(row);
      continue;
    }
    const roles = [...new Set(row.spans.flatMap((s) => s.roles))];
    const years = row.marks.map((m) => m.date).filter((d): d is string => !!d).sort();
    out.push(
      years.length
        ? { ...row, spans: [{ begin: years[0], end: years[years.length - 1], current: false, roles, inferred: true }] }
        : // Nic nie wiemy o datach — ale wiemy, że grał. Wiersz zostaje z paskiem
          // „?–?" przez całą oś; wyrzucenie go byłoby ukryciem prawdziwej informacji.
          { ...row, spans: [{ begin: null, end: null, current: false, roles, unknown: true }] },
    );
  }
  return out.sort((a, b) => {
    // Nieznane okresy na dół — nie da się ich ustawić w czasie.
    const au = a.spans[0]?.unknown ? 1 : 0;
    const bu = b.spans[0]?.unknown ? 1 : 0;
    if (au !== bu) return au - bu;
    const ab = a.spans[0]?.begin ?? "9999";
    const bb = b.spans[0]?.begin ?? "9999";
    return ab.localeCompare(bb) || a.name.localeCompare(b.name, "pl");
  });
}
