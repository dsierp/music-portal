import os from "node:os";
import path from "node:path";

/**
 * Wybór bazy — sama konfiguracja, bez otwierania połączenia.
 * Osobny plik, żeby skrypty (np. scripts/dev.ts) mogły sprawdzić, gdzie leży
 * baza, NIE otwierając jej — otwarcie zajęłoby katalog PGlite dla tego procesu.
 *
 *  - DATABASE_URL=postgresql://…  → prawdziwy Postgres (produkcja, docker),
 *  - DATABASE_URL pusty albo "pglite:<katalog>" → PGlite: Postgres w WASM
 *    zapisywany do pliku (zero instalacji).
 *
 * DLACZEGO BAZA NIE LEŻY W REPO:
 * PGlite trzyma bazę jako ~40 MB plików binarnych zmienianych przy każdym
 * zapisie. Katalog projektu to najgorsze miejsce na coś takiego:
 *  - na macOS ~/Documents i ~/Desktop bywają synchronizowane z iCloud Drive,
 *    a synchronizator podmieniający pliki pod pracującą bazą rozwala ją
 *    regularnie (objaw: RuntimeError: Aborted() i „Failed query" na każdym
 *    zapytaniu, wracające co kilkanaście minut mimo db:reset),
 *  - to samo robią Dropbox/OneDrive/Google Drive,
 *  - łatwo o przypadkowe `git add` 40 MB binariów albo skasowanie przez
 *    `git clean`.
 * Dlatego domyślnie baza siedzi w katalogu danych aplikacji użytkownika.
 * Starą ścieżkę (./data/pglite) da się odzyskać ustawiając DATABASE_URL.
 */
export const url = process.env.DATABASE_URL ?? "";
export const usingPglite = !url || url.startsWith("pglite:");

function defaultPgliteDir(): string {
  const home = os.homedir();
  if (process.platform === "darwin") return path.join(home, "Library", "Application Support", "music-portal", "pglite");
  if (process.platform === "win32") return path.join(process.env.LOCALAPPDATA ?? path.join(home, "AppData", "Local"), "music-portal", "pglite");
  return path.join(process.env.XDG_DATA_HOME ?? path.join(home, ".local", "share"), "music-portal", "pglite");
}

export const pgliteDir = usingPglite ? url.replace(/^pglite:/, "") || defaultPgliteDir() : null;
