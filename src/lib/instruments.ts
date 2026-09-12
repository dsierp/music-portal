/**
 * Grupy instrumentów — do filtrowania składu i kolorowania osi czasu.
 *
 * MusicBrainz nie ma słownika instrumentów w naszym rozumieniu: przy relacjach
 * wiszą surowe napisy („electric bass guitar", „drums (drum set)", „background
 * vocals", „membranophone"). Przy Ozzym daje to trzydzieści wariantów pięciu
 * instrumentów. Grupujemy je wzorcami, bo nikt nie szuka „membranophone" —
 * szuka perkusisty.
 */
export const INSTRUMENT_GROUPS = [
  { key: "vocals", match: /vocal|voice|śpiew/i },
  { key: "guitar", match: /guitar|gitar/i },
  { key: "bass", match: /bass|bas\b/i },
  { key: "drums", match: /drum|perkus|percussion|membranophone/i },
  { key: "keys", match: /key|piano|organ|synth|mellotron/i },
] as const;

export type InstrumentKey = (typeof INSTRUMENT_GROUPS)[number]["key"] | "other";

/** Do której grupy należy ten surowy opis roli. */
export function instrumentGroup(role: string): InstrumentKey {
  // Kolejność ma znaczenie: „electric bass guitar" to bas, nie gitara — dlatego
  // basu szukamy przed gitarą.
  if (/bass|bas\b/i.test(role)) return "bass";
  for (const g of INSTRUMENT_GROUPS) {
    if (g.key === "bass") continue;
    if (g.match.test(role)) return g.key;
  }
  return "other";
}

/** Wszystkie grupy, do których pasuje choć jedna rola tej osoby. */
export function groupsOf(roles: string[]): InstrumentKey[] {
  return [...new Set(roles.map(instrumentGroup))];
}

export function playsInstrument(roles: string[], key: string): boolean {
  if (!key) return true;
  return groupsOf(roles).includes(key as InstrumentKey);
}

/**
 * Żargon MusicBrainz na nazwę, którą ktoś rozpozna.
 *
 * MusicBrainz nazywa instrumenty według rodziny z klasyfikacji Hornbostela-Sachsa,
 * więc perkusista Atheista figuruje jako „membranophone", a nie jako perkusista.
 * Redaktorzy sięgają po te ogólne nazwy, gdy nie wiedzą, na czym dokładnie ktoś
 * grał — informacja jest prawdziwa, tylko zapisana dla muzykologa.
 *
 * Podmieniamy WYŁĄCZNIE takie ogólniki. „bass guitar" czy „lead vocals" zostają
 * bez zmian: są zrozumiałe, a przepisywanie ich po swojemu oddalałoby portal od
 * tego, co naprawdę stoi w bazie.
 */
const ZARGON: [RegExp, string][] = [
  [/^membranophone$/i, "drums"],
  [/^idiophone$/i, "percussion"],
  [/^aerophone$/i, "wind instrument"],
  [/^chordophone$/i, "string instrument"],
  [/^electrophone$/i, "electronic instrument"],
  [/^drums \(drum set\)$/i, "drums"],
  [/^other instruments$/i, "instrument"],
  [/^lamellophone$/i, "thumb piano"],
  [/^guitar family$/i, "guitar"],
  [/^percussion$/i, "percussion"],
  [/^family instruments?$/i, "instrument"],
];

export function czytelnaRola(role: string): string {
  const t = role.trim();
  for (const [wzorzec, nazwa] of ZARGON) if (wzorzec.test(t)) return nazwa;
  return t;
}
