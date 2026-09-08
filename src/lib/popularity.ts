/**
 * Kolejność kategorii według popularności.
 *
 * Dotąd wszędzie stała lista zaczynająca się od death metalu — bo tak wygląda
 * zestawienie „Pure New Shit". Dla kogoś, kto wchodzi pierwszy raz i nic
 * o sobie nie powiedział, to zły pierwszy ekran: dostaje najostrzejszą półkę
 * w sklepie, zanim zobaczy resztę.
 *
 * Popularność liczymy z tego, co ludzie faktycznie wybrali w profilach
 * (suma wag w `userGenres`), a nie z mojego widzimisię. Dopóki użytkowników
 * jest niewielu — albo baza milczy — decyduje lista zapasowa niżej, ułożona
 * według tego, ilu ludzi w ogóle słucha danej muzyki.
 *
 * Zalogowany widzi najpierw SWOJE style; popularność układa dopiero resztę.
 */
import { db, schema } from "@/db";
import { sql } from "drizzle-orm";

/**
 * Gdy nie ma jeszcze danych: od najszerzej słuchanych do najbardziej niszowych.
 * Klucze to i kategorie z profilu, i nazwy sekcji z importu („db" = death+black).
 * Zmiana kolejności portalu to zmiana tej jednej listy.
 */
export const FALLBACK_ORDER = [
  "pop",
  "hiphop",
  "electronic",
  "folk",
  "country",
  "classical",
  "jazz",
  "prog",
  "punk",
  "other",
  "db",
  "death",
  "black",
];

const fallbackRank = new Map(FALLBACK_ORDER.map((g, i) => [g, i]));

/** Suma wag w profilach: slug kategorii → ile „głosów" dostała. */
export async function categoryVotes(): Promise<Map<string, number>> {
  try {
    const rows = await db
      .select({ genre: schema.userGenres.genre, score: sql<number>`sum(${schema.userGenres.weight})` })
      .from(schema.userGenres)
      .groupBy(schema.userGenres.genre);
    return new Map(rows.map((r) => [r.genre, Number(r.score) || 0]));
  } catch {
    // baza niedostępna — lecimy na liście zapasowej
    return new Map();
  }
}

/**
 * Układa podane kategorie: najpierw te z największą liczbą głosów, potem reszta
 * według listy zapasowej, a na końcu (alfabetycznie) style, których nie znamy —
 * np. świeżo dobrane z MusicBrainz.
 */
export function sortByPopularity(slugs: string[], votes: Map<string, number>): string[] {
  return slugs.slice().sort((a, b) => {
    const va = votes.get(a) ?? 0;
    const vb = votes.get(b) ?? 0;
    if (va !== vb) return vb - va;
    const ra = fallbackRank.get(a);
    const rb = fallbackRank.get(b);
    if (ra !== undefined && rb !== undefined) return ra - rb;
    if (ra !== undefined) return -1;
    if (rb !== undefined) return 1;
    return a.localeCompare(b, "pl");
  });
}

/** Wygodne połączenie obu kroków. */
export async function orderByPopularity(slugs: string[]): Promise<string[]> {
  return sortByPopularity(slugs, await categoryVotes());
}
