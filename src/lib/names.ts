/** Porównywanie nazwisk z różnych źródeł (Wikipedia vs MusicBrainz). */

// Litery, których NFD nie rozkłada (nie są "litera + znak diakrytyczny",
// tylko osobnymi znakami) — a bez nich "Michał" nie spina się z "Michal".
const LETTERS: Record<string, string> = {
  ł: "l", ø: "o", đ: "d", ð: "d", þ: "th", ß: "ss", æ: "ae", œ: "oe", ı: "i", ħ: "h", ŀ: "l",
};

/** "Michał Łoś-Kowalczyk " → "michal los-kowalczyk" — do porównań, nie do wyświetlania. */
export function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // znaki diakrytyczne
    .toLowerCase()
    .replace(/[łøđðþßæœıħŀ]/g, (c) => LETTERS[c] ?? c)
    .replace(/["'’`.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Warianty nazwiska, pod którymi warto szukać dopasowania: pełne oraz
 * "imię nazwisko" bez drugiego imienia/inicjału (Wikipedia i MusicBrainz
 * często różnią się właśnie tym).
 */
export function nameKeys(s: string): string[] {
  const full = normalizeName(s);
  const keys = new Set([full]);
  const parts = full.split(" ").filter(Boolean);
  if (parts.length > 2) keys.add(`${parts[0]} ${parts[parts.length - 1]}`);
  return [...keys];
}
