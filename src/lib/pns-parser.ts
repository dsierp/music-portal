/**
 * Parser danych ze strony „Pure New Shit” (jeden plik HTML z `const SECTIONS = [...]`
 * i `const BEST = {...}` w skrypcie). Wyciąga te literały i bezpiecznie je ewaluuje
 * (Node `vm`, bez dostępu do niczego), zwracając czyste obiekty.
 */
import vm from "node:vm";

export type ReleaseRow = [
  id: string, genre: string, star: number, artist: string | null, album: string | null,
  label: string | null, description: string, reviews?: string | null, flag?: string | null, date?: string | null,
];
export interface PnsSection {
  id: string;
  cls: "red" | "morgue";
  pick?: string;
  title: string;
  date: string;
  sub?: string;
  releases: ReleaseRow[];
}
export type BestRow = [artist: string, album: string, label: string, genre: string, country: string, released: string, scores: string, why: string];
export interface PnsBest {
  [year: string]: { label: string; sub?: string; cats: Record<string, BestRow[]> };
}
export interface PnsData {
  sections: PnsSection[];
  best: PnsBest;
  bestCats: Record<string, string>;
}

/** Zwraca tekst zbalansowanego literału zaczynającego się od nawiasu na pozycji `start`. */
function balanced(src: string, start: number): string {
  const open = src[start];
  const close = open === "[" ? "]" : open === "{" ? "}" : ")";
  let depth = 0, i = start, str: string | null = null;
  for (; i < src.length; i++) {
    const c = src[i];
    if (str) {
      if (c === "\\") { i++; continue; }
      if (c === str) str = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { str = c; continue; }
    if (c === "/" && src[i + 1] === "/") { i = src.indexOf("\n", i); if (i < 0) break; continue; }
    if (c === "/" && src[i + 1] === "*") { i = src.indexOf("*/", i) + 1; continue; }
    if (c === "[" || c === "{" || c === "(") depth++;
    else if (c === "]" || c === "}" || c === ")") {
      depth--;
      if (depth === 0 && c === close) return src.slice(start, i + 1);
    }
  }
  throw new Error("Niezbalansowany literał od pozycji " + start);
}

function literal(src: string, name: string): unknown {
  const m = new RegExp(`const\\s+${name}\\s*=\\s*`).exec(src);
  if (!m) throw new Error(`Brak "const ${name}" w pliku`);
  const start = m.index + m[0].length;
  const text = balanced(src, start);
  return vm.runInNewContext("(" + text + ")", Object.create(null), { timeout: 2000 });
}

export function parsePureNewShit(html: string): PnsData {
  return {
    sections: literal(html, "SECTIONS") as PnsSection[],
    best: literal(html, "BEST") as PnsBest,
    bestCats: literal(html, "BEST_CATS") as Record<string, string>,
  };
}

/** "04.09.2026" → Date; "05.09 – 11.09.2026" → data końcowa (piątek). */
export function sectionSortDate(date: string): Date {
  const parts = date.match(/(\d{2})\.(\d{2})(?:\.(\d{4}))?/g) ?? [];
  const last = parts[parts.length - 1];
  const m = last?.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (!m) return new Date(0);
  return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
}
