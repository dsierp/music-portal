import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

/**
 * Prosty cache odpowiedzi zewnętrznych API w Postgresie.
 * Nie budujemy własnej bazy wiedzy — to tylko bufor, który wygasa.
 */
export async function cached<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
  try {
    const hit = await db.query.apiCache.findFirst({ where: eq(schema.apiCache.key, key) });
    if (hit && Date.now() - hit.fetchedAt.getTime() < ttlSeconds * 1000) return hit.json as T;
  } catch {
    // brak bazy (np. testy) — lecimy bez cache
  }
  const value = await fetcher();
  try {
    await db
      .insert(schema.apiCache)
      .values({ key, json: value as object, fetchedAt: new Date() })
      .onConflictDoUpdate({ target: schema.apiCache.key, set: { json: value as object, fetchedAt: new Date() } });
  } catch {
    /* ignore */
  }
  return value;
}

export const TTL = {
  search: 60 * 60 * 24, // 1 dzień
  lookup: 60 * 60 * 24 * 7, // 7 dni
  wiki: 60 * 60 * 24 * 14,
};
