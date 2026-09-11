/** Zapytania do list z importu (premiery, best of). */
import { asc, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { genreToSection, MAIN_BY_SLUG } from "./genres";
import { genreImage } from "./genre-art";

export const GENRE_LABELS: Record<string, string> = {
  db: "Death / black metal",
  death: "Death metal",
  black: "Black metal",
  prog: "Prog metal / prog rock",
  other: "Inne metal / ciężkie brzmienia",
  jazz: "Jazz",
};
/**
 * Kolejność zapasowa kategorii. Uwaga: o realnej kolejności sekcji decyduje
 * popularność wśród użytkowników (`src/lib/popularity.ts` → FALLBACK_ORDER);
 * ta lista została dla miejsc, które pytają wprost o porządek metalowy.
 * Blok niemetalowy trzyma kolejność z artefaktu („Poza kanonem").
 */
export const GENRE_ORDER = [
  "death", "black", "db", "prog", "other", "jazz",
  "punk", "electronic", "folk", "country", "classical", "hiphop", "pop",
];

/**
 * Etykieta gatunku. Sekcje z importu PNS mają swoje nazwy (db/prog/other/jazz);
 * premiery dobrane z MusicBrainz trzymają w tym polu wprost nazwę stylu
 * („country", „hip hop"), więc dla nich wystarczy ją ładnie pokazać.
 */
/**
 * Import PNS trzyma death i black w jednym worku („db"), ale to dwa różne
 * światy i w zestawieniu były rozbite. Rozdzielamy je po opisie — PNS zaczyna
 * go od gatunku („avant-garde black metal — …", „dysonansowy death metal — …").
 * Gdy z opisu nic nie wynika, zostawiamy wspólną kategorię.
 */
export function splitDb(genre: string, description: string): string {
  if (genre !== "db") return genre;
  const d = description.toLowerCase().replace(/<[^>]+>/g, " ").slice(0, 220);
  const black = d.indexOf("black");
  const death = d.indexOf("death");
  if (black < 0 && death < 0) return "db";
  if (black >= 0 && (death < 0 || black < death)) return "black";
  return "death";
}

/**
 * Kategoria zestawienia dla stylu wybranego przez użytkownika.
 * „technical death metal" → death, „atmospheric black metal" → black,
 * „modern jazz" → jazz, „country" → country (bo tak trzymają je premiery z MB).
 */
export function styleToCategory(style: string): string {
  const s = style.toLowerCase();
  // Profil trzyma teraz wprost slugi głównych kategorii — te przechodzą bez zmian.
  if (MAIN_BY_SLUG.has(s)) return s;
  if (s.includes("black")) return "black";
  if (s.includes("death")) return "death";
  const section = genreToSection(style);
  if (section === "jazz" || section === "prog" || section === "other") return section;
  return s;
}

export function genreLabel(genre: string): string {
  return GENRE_LABELS[genre] ?? MAIN_BY_SLUG.get(genre)?.label ?? genre.charAt(0).toUpperCase() + genre.slice(1);
}

/**
 * Grafika nagłówka sekcji premier. Szukamy pliku po nazwie w
 * public/img/genres (patrz genre-art.ts) — żeby dorzucić własną, wystarczy
 * wrzucić tam plik, bez zmian w kodzie.
 */
export function sectionImage(genre: string): string | null {
  const names: Record<string, string[]> = {
    db: ["death-black-metal", "death metal", "black metal", "metal"],
    death: ["death metal", "metal"],
    black: ["black metal", "metal"],
    prog: ["prog", "progressive rock", "progressive metal"],
    other: ["inne metal", "metal"],
    jazz: ["jazz"],
    // Blok „poza kanonem" — slug kategorii nie zawsze zgadza się z nazwą pliku
    // (hiphop → hip-hop.jpg), więc każdy kod ma tu swoje zejście do szerszej nazwy.
    punk: ["punk", "punk-hardcore", "punk rock"],
    electronic: ["electronic"],
    folk: ["folk", "singer-songwriter", "neofolk"],
    country: ["country", "country-americana"],
    classical: ["classical", "klasyka", "classical-contemporary"],
    hiphop: ["hip-hop", "hip hop"],
    pop: ["pop"],
  };
  const [first, ...rest] = names[genre] ?? [genre];
  return genreImage(first, ...rest);
}
export const FLAG_LABELS: Record<string, string> = { ep: "EP", comp: "kompilacja", reissue: "reedycja", live: "live", instr: "instrumental" };

/**
 * Najnowsze wydania zestawienia — domyślnie dwa: piątek i tydzień po nim.
 *
 * `limit` liczy TERMINY, nie sekcje. Od 11.09.2026 jeden termin ma dwie sekcje
 * (metalowa + „poza kanonem"), więc dawne `.limit(2)` po wierszach pokazywało
 * dwa bloki tego samego dnia i gubiło cały drugi tydzień. Bierzemy więc tyle
 * najnowszych dat, ile poproszono, i wszystkie sekcje z tych dat — blok
 * niemetalowy zawsze pod swoim piątkiem, nie zamiast niego.
 */
export async function latestSections(limit = 2) {
  const secs = await db.select().from(schema.releaseSections).orderBy(desc(schema.releaseSections.sortDate), asc(schema.releaseSections.kind));
  const terminy = [...new Set(secs.map((s) => s.sortDate.getTime()))].slice(0, limit);
  const wybrane = secs.filter((s) => terminy.includes(s.sortDate.getTime()));
  // chronologicznie, a w obrębie jednego terminu: najpierw sekcja główna
  return wybrane.sort(
    (a, b) => a.sortDate.getTime() - b.sortDate.getTime() || Number(a.id.endsWith("-poza")) - Number(b.id.endsWith("-poza")),
  );
}

export async function allSections() {
  return db.select().from(schema.releaseSections).orderBy(desc(schema.releaseSections.sortDate), asc(schema.releaseSections.kind));
}

export async function releasesFor(sectionIds: string[]) {
  if (!sectionIds.length) return [];
  return db.select().from(schema.releases).where(inArray(schema.releases.sectionId, sectionIds)).orderBy(asc(schema.releases.position));
}

export async function bestOf(year: string) {
  const y = await db.query.bestOfYears.findFirst({ where: eq(schema.bestOfYears.year, year) });
  const entries = await db.select().from(schema.bestOfEntries).where(eq(schema.bestOfEntries.year, year)).orderBy(asc(schema.bestOfEntries.category), asc(schema.bestOfEntries.rank));
  return { year: y, entries };
}
export async function bestOfYears() {
  return db.select().from(schema.bestOfYears).orderBy(desc(schema.bestOfYears.year));
}
export const BEST_CATS: Record<string, string> = {
  death: "Death metal",
  black: "Black metal",
  other: "Inne metal — doom / sludge / thrash / heavy / avant",
  prog: "Prog rock / prog metal",
  jazz: "Jazz",
};
export const BEST_ORDER = ["death", "black", "other", "prog", "jazz"];
