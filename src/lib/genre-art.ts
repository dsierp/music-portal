import fs from "node:fs";
import path from "node:path";

/**
 * Grafiki gatunków — bez dotykania kodu.
 *
 * ŻEBY DODAĆ GRAFIKĘ: wrzuć plik do `public/img/genres/` i nazwij go jak gatunek,
 * małymi literami, spacje jako myślniki:
 *     public/img/genres/death-metal.jpg
 *     public/img/genres/black-metal.png
 *     public/img/genres/spiritual-jazz.webp
 * Tyle. Portal znajdzie go sam przy najbliższym starcie.
 *
 * ŻEBY DODAĆ GATUNEK: dopisz go do GENRE_GROUPS w genres.ts — grafika podepnie
 * się automatycznie, gdy tylko wrzucisz plik o pasującej nazwie.
 *
 * Gdy pliku nie ma, używamy grafiki grupy (metal/prog/jazz), a gdy i jej nie ma —
 * nie pokazujemy nic. Nigdzie nie ma sztywnej listy ścieżek do pilnowania.
 */
const DIR = path.join(process.cwd(), "public", "img", "genres");
const AVATAR_DIR = path.join(process.cwd(), "public", "img", "avatars");
const EXTS = [".jpg", ".jpeg", ".png", ".webp", ".avif", ".svg"];

export function genreSlug(genre: string): string {
  return genre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Nazwy plików w katalogu (czytane raz — katalog nie zmienia się w trakcie działania). */
const caches = new Map<string, Map<string, string>>();
function indexOf(dir: string, urlBase: string): Map<string, string> {
  const cached = caches.get(dir);
  if (cached) return cached;
  const map = new Map<string, string>();
  try {
    for (const file of fs.readdirSync(dir)) {
      const ext = path.extname(file).toLowerCase();
      if (!EXTS.includes(ext)) continue;
      map.set(path.basename(file, ext).toLowerCase(), `${urlBase}/${file}`);
    }
  } catch {
    // katalog jeszcze nie istnieje — nic się nie dzieje, po prostu brak grafik
  }
  caches.set(dir, map);
  return map;
}
function index(): Map<string, string> {
  return indexOf(DIR, "/img/genres");
}

/**
 * Ścieżka do grafiki gatunku albo null. `fallbacks` to szersze nazwy, którymi
 * warto się ratować (np. dla "technical death metal" → "death metal" → "metal").
 */
export function genreImage(genre: string, ...fallbacks: string[]): string | null {
  const idx = index();
  for (const name of [genre, ...fallbacks]) {
    const hit = idx.get(genreSlug(name));
    if (hit) return hit;
  }
  return null;
}

/**
 * Postać gatunku — sylwetka na wierzchu nagłówka (jak demon z Pure New Shit).
 *
 * ŻEBY DODAĆ POSTAĆ: wrzuć plik do `public/img/avatars/` i nazwij go jak
 * kategorię ze slugu (`public/img/avatars/punk.svg`). Rysunki są ciemne, na
 * przezroczystym tle — leżą na tle nagłówka, nie zamiast niego.
 */
export function avatarImage(genre: string, ...fallbacks: string[]): string | null {
  const idx = indexOf(AVATAR_DIR, "/img/avatars");
  for (const name of [genre, ...fallbacks]) {
    const hit = idx.get(genreSlug(name));
    if (hit) return hit;
  }
  return null;
}
