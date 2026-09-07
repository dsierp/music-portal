/**
 * Wybór bazy — sama konfiguracja, bez otwierania połączenia.
 * Osobny plik, żeby skrypty (np. scripts/dev.ts) mogły sprawdzić, gdzie leży
 * baza, NIE otwierając jej — otwarcie zajęłoby katalog PGlite dla tego procesu.
 *
 *  - DATABASE_URL=postgresql://…  → prawdziwy Postgres (produkcja, docker),
 *  - DATABASE_URL pusty albo "pglite:<katalog>" → PGlite: Postgres w WASM
 *    zapisywany do pliku (zero instalacji; domyślnie ./data/pglite).
 */
export const url = process.env.DATABASE_URL ?? "";
export const usingPglite = !url || url.startsWith("pglite:");
export const pgliteDir = usingPglite ? url.replace(/^pglite:/, "") || "./data/pglite" : null;
