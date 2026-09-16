/**
 * Dziennik odsłuchań — co naprawdę leciało i co z tego wynika.
 *
 * Portal nie jest odtwarzaczem i nie będzie: człowiek słucha w Spotify albo
 * w Tidalu, a tu przychodzi grzebać. Ale skoro i tak pytamy „co teraz gra"
 * (kafelek na stronie głównej) i i tak wiemy, w co ktoś wyszedł z przystanku,
 * to szkoda tego nie zapamiętać. Z tego robi się rzecz, której żaden z tych
 * serwisów nie da: „w zeszłym tygodniu siedziałeś w tym — spróbuj tamtego".
 *
 * Źródła są trzy: „co teraz gra" (pytamy i tak), wyjścia w serwis z portalu
 * (jedyne, co działa dla Tidala) i JEDNORAZOWA historia ze Spotify —
 * ostatnie 50 utworów, patrz `synchronizujHistorie`. To ostatnie doszło,
 * bo dziennik zaczynający się „od dziś" wygląda jak zepsuta funkcja.
 */
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/db";

/**
 * Ile czasu musi minąć, żeby ten sam utwór policzyć drugi raz.
 *
 * Kafelek odpytuje Spotify co pół minuty, a utwór trwa kilka minut — bez tego
 * jedno przesłuchanie zapisywałoby się dziesięć razy i „najczęściej grane"
 * mówiłoby tylko o tym, jak długo miałeś otwartą kartę.
 */
const POWTORKA_MS = 20 * 60 * 1000;

export interface Odsluch {
  artist: string;
  title: string;
  album: string | null;
  mbid?: string | null;
  cover?: string | null;
  source: "spotify" | "klik";
}

/** Zapis jednego odsłuchania. Cichy — to dodatek, nie treść. */
export async function zapiszOdsluch(userId: string, o: Odsluch): Promise<void> {
  const artist = o.artist.trim().slice(0, 300);
  const title = o.title.trim().slice(0, 300);
  if (!artist || !title) return;
  try {
    const [ostatni] = await db
      .select({ at: schema.plays.playedAt })
      .from(schema.plays)
      .where(
        and(
          eq(schema.plays.userId, userId),
          eq(schema.plays.artist, artist),
          eq(schema.plays.title, title),
          gte(schema.plays.playedAt, new Date(Date.now() - POWTORKA_MS)),
        ),
      )
      .limit(1);
    if (ostatni) return;
    await db.insert(schema.plays).values({
      userId,
      artist,
      title,
      album: o.album?.trim().slice(0, 300) || null,
      mbid: o.mbid ?? null,
      cover: o.cover ?? null,
      source: o.source,
    });
  } catch {
    // Dziennik nie ma prawa popsuć niczego, co człowiek właśnie robi.
  }
}

/** Ostatnie odsłuchania, od najnowszego. */
export async function ostatnieOdsluchy(userId: string, limit = 100) {
  return db
    .select()
    .from(schema.plays)
    .where(eq(schema.plays.userId, userId))
    .orderBy(desc(schema.plays.playedAt))
    .limit(limit);
}

/**
 * W czym siedziałeś przez ostatnie dni — zliczone po artyście.
 *
 * Artysta, nie utwór: do pytania „poszukaj czegoś w tym klimacie" liczy się to,
 * KOGO się słuchało, a nie który kawałek poszedł trzy razy pod rząd.
 */
export async function wCzymSiedzialem(userId: string, dni = 14, ile = 8) {
  const od = new Date(Date.now() - dni * 24 * 3600 * 1000);
  const rows = await db
    .select({ artist: schema.plays.artist, n: sql<number>`count(*)` })
    .from(schema.plays)
    .where(and(eq(schema.plays.userId, userId), gte(schema.plays.playedAt, od)))
    .groupBy(schema.plays.artist)
    .orderBy(desc(sql`count(*)`))
    .limit(ile);
  return rows.map((r) => ({ artist: r.artist, ile: Number(r.n) }));
}

/** Płyty, które przewinęły się ostatnio — materiał na „zagraj to jeszcze raz". */
export async function ostatniePlyty(userId: string, dni = 30, ile = 20) {
  const od = new Date(Date.now() - dni * 24 * 3600 * 1000);
  const rows = await db
    .select({
      artist: schema.plays.artist,
      album: schema.plays.album,
      mbid: sql<string | null>`max(${schema.plays.mbid})`,
      kiedy: sql<Date>`max(${schema.plays.playedAt})`,
      n: sql<number>`count(*)`,
    })
    .from(schema.plays)
    .where(and(eq(schema.plays.userId, userId), gte(schema.plays.playedAt, od)))
    .groupBy(schema.plays.artist, schema.plays.album)
    .orderBy(desc(sql`max(${schema.plays.playedAt})`))
    .limit(ile);
  return rows.filter((r) => r.album).map((r) => ({ ...r, album: r.album!, ile: Number(r.n) }));
}

/**
 * Ostatnio grane jako KAFELKI — po jednym na płytę, z okładką.
 *
 * Ludzie rozpoznają płyty po okładkach; lista napisów na stronie głównej
 * byłaby spisem, a nie zajawką. Grupujemy po płycie, bo trzy kawałki z tego
 * samego albumu to jedno wspomnienie, nie trzy.
 */
export async function ostatnieKafelki(userId: string, ile = 6) {
  const rows = await db
    .select({
      artist: schema.plays.artist,
      album: schema.plays.album,
      mbid: sql<string | null>`max(${schema.plays.mbid})`,
      cover: sql<string | null>`max(${schema.plays.cover})`,
      kiedy: sql<Date>`max(${schema.plays.playedAt})`,
    })
    .from(schema.plays)
    .where(eq(schema.plays.userId, userId))
    .groupBy(schema.plays.artist, schema.plays.album)
    .orderBy(desc(sql`max(${schema.plays.playedAt})`))
    .limit(ile);
  return rows.filter((r) => r.album).map((r) => ({ ...r, album: r.album! }));
}

/**
 * Jednorazowe dociągnięcie historii ze Spotify — ostatnie 50 utworów.
 *
 * Dziennik zaczynał się w dniu, w którym ktoś pierwszy raz zostawił portal
 * otwarty: jedna płyta w „Ostatnio" wygląda na zepsutą funkcję, a nie na nową.
 * Spotify pamięta pięćdziesiąt ostatnich odtworzeń — i to wystarcza, żeby
 * ekran miał sens od pierwszego wejścia.
 *
 * Pytamy najwyżej raz na kwadrans: przeszłość się nie zmienia, a kafelek
 * „słuchasz teraz" odpytuje co pół minuty i nie ma sensu przy każdym jego
 * mrugnięciu ciągnąć pięćdziesięciu pozycji.
 */
export async function synchronizujHistorie(userId: string): Promise<void> {
  const { cacheHasNote, cacheNote } = await import("./cache");
  const klucz = `spotify:historia:${userId}`;
  if (await cacheHasNote(klucz).catch(() => true)) return;
  await cacheNote(klucz, 15 * 60).catch(() => {});
  try {
    const { recentlyPlayed } = await import("./spotify");
    const lista = await recentlyPlayed(userId);
    for (const o of lista) {
      // `playedAt` bierzemy od Spotify, nie z zegara — inaczej cała historia
      // wylądowałaby w dzienniku pod dzisiejszą datą.
      const artist = o.artist.trim().slice(0, 300);
      const title = o.title.trim().slice(0, 300);
      if (!artist || !title) continue;
      const [jest] = await db
        .select({ id: schema.plays.id })
        .from(schema.plays)
        .where(and(eq(schema.plays.userId, userId), eq(schema.plays.artist, artist), eq(schema.plays.title, title), eq(schema.plays.playedAt, o.at)))
        .limit(1);
      if (jest) continue;
      await db.insert(schema.plays).values({
        userId,
        artist,
        title,
        album: o.album.slice(0, 300) || null,
        cover: o.cover,
        source: "spotify",
        playedAt: o.at,
      });
    }
  } catch {
    // Historia to dodatek. Gdy Spotify odmówi (stary zakres uprawnień —
    // konto podłączone przed tą zmianą), po prostu jej nie ma.
  }
}
