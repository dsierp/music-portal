/** Zapytania do list z importu (premiery, best of). */
import { asc, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";

export const GENRE_LABELS: Record<string, string> = {
  db: "Death / black metal",
  prog: "Prog metal / prog rock",
  other: "Inne metal / ciężkie brzmienia",
  jazz: "Jazz",
};
export const GENRE_ORDER = ["db", "prog", "other", "jazz"];

/**
 * Grafika nagłówka dla gatunku. Na razie ze zdjęć w public/img — żeby dołożyć
 * własną (np. dedykowaną grafikę death metalową), wystarczy wrzucić plik do
 * public/img i podmienić ścieżkę tutaj.
 */
export const GENRE_IMAGES: Record<string, string> = {
  db: "/img/studio.jpg",
  prog: "/img/konsola.jpg",
  other: "/img/talerz.jpg",
  jazz: "/img/winyl.jpg",
};
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
