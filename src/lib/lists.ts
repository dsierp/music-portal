/** Zapytania do list z importu (premiery, best of). */
import { asc, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { genreToSection } from "./genres";
import { genreImage } from "./genre-art";

export const GENRE_LABELS: Record<string, string> = {
  db: "Death / black metal",
  death: "Death metal",
  black: "Black metal",
  prog: "Prog metal / prog rock",
  other: "Inne metal / ciężkie brzmienia",
  jazz: "Jazz",
};
export const GENRE_ORDER = ["death", "black", "db", "prog", "other", "jazz"];

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
  if (s.includes("black")) return "black";
  if (s.includes("death")) return "death";
  const section = genreToSection(style);
  if (section === "jazz" || section === "prog" || section === "other") return section;
  return s;
}

export function genreLabel(genre: string): string {
  return GENRE_LABELS[genre] ?? genre.charAt(0).toUpperCase() + genre.slice(1);
}

/**
 * Grafika nagłówka sekcji premier. Szukamy pliku po nazwie w
 * public/img/genres (patrz genre-art.ts) — żeby dorzucić własną, wystarczy
 * wrzucić tam plik, bez zmian w kodzie.
 */
export function sectionImage(genre: string): string | null {
  const names: Record<string, string[]> = {
    db: ["death-black-metal", "death metal", "black metal", "metal"],
    prog: ["prog", "progressive rock", "progressive metal"],
    other: ["inne metal", "metal"],
    jazz: ["jazz"],
  };
  const [first, ...rest] = names[genre] ?? [genre];
  return genreImage(first, ...rest);
}
export const FLAG_LABELS: Record<string, string> = { ep: "EP", comp: "kompilacja", reissue: "reedycja", live: "live", instr: "instrumental" };

export async function latestSections(limit = 2) {
  const secs = await db.select().from(schema.releaseSections).orderBy(desc(schema.releaseSections.sortDate), asc(schema.releaseSections.kind)).limit(limit);
  // pokazujemy najnowszy piątek + tydzień po nim, w kolejności chronologicznej
  return secs.sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime());
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
