import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

/**
 * Prosty cache odpowiedzi zewnętrznych API w Postgresie.
 * Nie budujemy własnej bazy wiedzy — to tylko bufor, który wygasa.
 */
export async function cached<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
  // Tryb testowy (MB_FIXTURES) omija cache całkowicie. Bez tego test na maszynie
  // z działającym .env czytał PRAWDZIWE, zapisane w dev-bazie odpowiedzi
  // MusicBrainz zamiast fixture — i „przechodził" albo wywalał się zależnie od
  // tego, co ktoś wcześniej klikał w przeglądarce.
  if (process.env.MB_FIXTURES) return fetcher();
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

/**
 * Krótka notatka w tym samym buforze — bez wywoływania czegokolwiek.
 *
 * Używamy jej do zapamiętywania, że zewnętrzny serwis odmówił obsługi danego
 * konta. Bufor pasuje idealnie: taka informacja MA wygasnąć sama, bo odmowa
 * bywa chwilowa albo znika, gdy właściciel aplikacji kogoś dopisze.
 */
export async function cacheNote(key: string, ttlSeconds: number, value: unknown = true) {
  try {
    await db
      .insert(schema.apiCache)
      .values({ key, json: { v: value, ttl: ttlSeconds } as object, fetchedAt: new Date() })
      .onConflictDoUpdate({ target: schema.apiCache.key, set: { json: { v: value, ttl: ttlSeconds } as object, fetchedAt: new Date() } });
  } catch {
    /* ignore */
  }
}

/** Czy notatka wciąż obowiązuje. Brak notatki i awaria bazy znaczą „nie". */
export async function cacheHasNote(key: string): Promise<boolean> {
  try {
    const hit = await db.query.apiCache.findFirst({ where: eq(schema.apiCache.key, key) });
    if (!hit) return false;
    const ttl = Number((hit.json as { ttl?: number })?.ttl ?? 0);
    return Date.now() - hit.fetchedAt.getTime() < ttl * 1000;
  } catch {
    return false;
  }
}

export const TTL = {
  search: 60 * 60 * 24, // 1 dzień
  lookup: 60 * 60 * 24 * 7, // 7 dni
  wiki: 60 * 60 * 24 * 14,
};
