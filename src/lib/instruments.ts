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
