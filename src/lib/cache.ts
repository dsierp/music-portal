import { eq, like, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";

/**
 * Prosty cache odpowiedzi zewnętrznych API w Postgresie.
 * Nie budujemy własnej bazy wiedzy — to tylko bufor, który wygasa.
 *
 * UWAGA, DROGO OKUPIONA: bufor MUSI sam po sobie sprzątać. Przez pierwsze
 * miesiące nie usuwał niczego — każda odpowiedź MusicBrainz, Wikipedii i Cover
 * Art Archive zostawała na zawsze — aż tabela dobiła do limitu Neona (512 MB).
 * Po jego przekroczeniu baza odmawia ZAPISÓW (nie dało się postawić oceny)
 * i dławi odczyty tak, że strony wiszą minutami. Wyglądało to na powolność
 * MusicBrainz, a to był nasz śmietnik.
 */

/**
 * Najstarsze wpisy, które trzymamy. Najdłuższy TTL w portalu to 30 dni, więc
 * wszystko starsze jest z definicji nieświeże — nikt tego już nie odczyta.
 */
const MAX_WIEK_DNI = 31;
/** Odpowiedzi grubsze niż to nie trafiają do bufora — patrz `zaGruby`. */
const MAX_BAJTOW = 256 * 1024;
/** Co ile zapisów zaglądamy, czy nie ma czego wyrzucić (1 = zawsze). */
const SZANSA_SPRZATANIA = 0.02;

function zaGruby(v: unknown): boolean {
  try {
    // Pojedyncze odpowiedzi potrafią mieć megabajty (dyskografia molocha
    // z pełnymi relacjami). Takie wpisy zjadają bufor na rzecz setek małych,
    // które są odczytywane o wiele częściej.
    return JSON.stringify(v).length > MAX_BAJTOW;
  } catch {
    return true;
  }
}

/** Kasuje wpisy starsze niż MAX_WIEK_DNI. Cicha, bo to sprzątanie w tle. */
export async function cacheSweep(): Promise<number> {
  try {
    const usuniete = await db
      .delete(schema.apiCache)
      .where(lt(schema.apiCache.fetchedAt, sql`now() - interval '${sql.raw(String(MAX_WIEK_DNI))} days'`))
      .returning({ k: schema.apiCache.key });
    return usuniete.length;
  } catch {
    return 0;
  }
}
/**
 * Pobrania, które właśnie trwają.
 *
 * Bez tego dwie sekcje strony artysty pytające o to samo (grał na / produkował
 * czytają tę samą paczkę nagrań) startują równolegle, obie trafiają w pustą
 * bazę i obie jadą do MusicBrainz. A że mbFetch stoi w kolejce po sekundzie na
 * zapytanie, to dosłownie podwojony czas ładowania. Dochodzi drugi przypadek:
 * odpowiedzi grubsze niż MAX_BAJTOW w ogóle nie trafiają do bufora, więc dla
 * nich to jedyna ochrona przed podwójnym pobraniem.
 */
const wTrakcie = new Map<string, Promise<unknown>>();

export async function cached<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
  const trwa = wTrakcie.get(key);
  if (trwa) return trwa as Promise<T>;
  const moje = cachedWewn(key, ttlSeconds, fetcher).finally(() => wTrakcie.delete(key));
  wTrakcie.set(key, moje);
  return moje;
}

async function cachedWewn<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
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
  if (zaGruby(value)) return value;
  try {
    await db
      .insert(schema.apiCache)
      .values({ key, json: value as object, fetchedAt: new Date() })
      .onConflictDoUpdate({ target: schema.apiCache.key, set: { json: value as object, fetchedAt: new Date() } });
    // Sprzątamy przy okazji zapisu, raz na jakiś czas: bez osobnego zadania
    // w tle, a bufor nie ma szans urosnąć ponad to, co naprawdę świeże.
    if (Math.random() < SZANSA_SPRZATANIA) void cacheSweep();
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

/** Usunięcie wpisu z bufora — gdy zapisany wynik okazał się bezwartościowy. */
export async function cacheForget(key: string) {
  try {
    await db.delete(schema.apiCache).where(eq(schema.apiCache.key, key));
  } catch {
    /* ignore */
  }
}

/** Wymiecenie całej rodziny wpisów (po przedrostku klucza). Zwraca ile poszło. */
export async function cacheForgetPrefix(prefix: string): Promise<number> {
  try {
    const usuniete = await db.delete(schema.apiCache).where(like(schema.apiCache.key, `${prefix}%`)).returning({ k: schema.apiCache.key });
    return usuniete.length;
  } catch {
    return 0;
  }
}

export const TTL = {
  // Nazwy zespołów i tytuły płyt się nie zmieniają, a szukanie w MusicBrainz
  // jest najdroższą rzeczą w portalu (jedno zapytanie na sekundę, do tego
  // ponawiane przy przeciążeniu). Dzień był ostrożnością bez pokrycia: to samo
  // pytanie zadane tydzień później i tak dawało tę samą listę, tylko po
  // kilkunastu sekundach czekania.
  search: 60 * 60 * 24 * 30, // 30 dni
  lookup: 60 * 60 * 24 * 7, // 7 dni
  wiki: 60 * 60 * 24 * 14,
};

/**
 * Licznik dzienny — ile razy ktoś skorzystał z czegoś płatnego.
 *
 * Po co: „podróż w nieznane" woła model językowy, a to kosztuje właściciela
 * portalu przy każdym kliknięciu. Bez limitu jedna osoba (albo jeden bot na
 * czyimś koncie) może wydać cudze pieniądze, klikając w kółko.
 *
 * Siedzi w tym samym buforze co reszta, bo to dane, które MAJĄ wygasnąć —
 * klucz zawiera datę, więc wczorajszy licznik nikogo nie obchodzi i zniknie
 * przy najbliższym sprzątaniu. Awaria bazy przepuszcza (zwraca 0): lepiej
 * pozwolić na jedno zapytanie za dużo niż zablokować ekran przez kłopot,
 * który nie ma z nim nic wspólnego.
 */
export async function licznikDzienny(kto: string, co: string): Promise<number> {
  const dzis = new Date().toISOString().slice(0, 10);
  const key = `limit:${co}:${dzis}:${kto}`;
  try {
    const hit = await db.query.apiCache.findFirst({ where: eq(schema.apiCache.key, key) });
    return Number((hit?.json as { n?: number })?.n ?? 0);
  } catch {
    return 0;
  }
}

/** Podbija licznik z `licznikDzienny` i zwraca nową wartość. */
export async function podbijLicznik(kto: string, co: string): Promise<number> {
  const dzis = new Date().toISOString().slice(0, 10);
  const key = `limit:${co}:${dzis}:${kto}`;
  const teraz = (await licznikDzienny(kto, co)) + 1;
  try {
    await db
      .insert(schema.apiCache)
      .values({ key, json: { n: teraz } as object, fetchedAt: new Date() })
      .onConflictDoUpdate({ target: schema.apiCache.key, set: { json: { n: teraz } as object, fetchedAt: new Date() } });
  } catch {
    /* ignore */
  }
  return teraz;
}

/**
 * Zwykły zapis i odczyt pod kluczem — ten sam bufor, bez wywoływania czegokolwiek.
 *
 * Po co osobno od `cached`: stan układanej podróży nie jest odpowiedzią żadnego
 * API, tylko notatką „robię / gotowe / poszło źle", którą pisze jedno żądanie,
 * a czyta drugie. Bufor pasuje, bo taka notatka MA zniknąć sama — po dobie
 * nikogo nie obchodzi podróż, której nie doczekał.
 */
export async function kvSet(key: string, value: unknown) {
  try {
    await db
      .insert(schema.apiCache)
      .values({ key, json: value as object, fetchedAt: new Date() })
      .onConflictDoUpdate({ target: schema.apiCache.key, set: { json: value as object, fetchedAt: new Date() } });
  } catch {
    /* ignore */
  }
}

export async function kvGet<T>(key: string): Promise<T | null> {
  try {
    const hit = await db.query.apiCache.findFirst({ where: eq(schema.apiCache.key, key) });
    return (hit?.json as T) ?? null;
  } catch {
    return null;
  }
}
