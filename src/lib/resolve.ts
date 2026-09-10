/**
 * Łączenie pozycji z list (premiery, best of) z MusicBrainz.
 * Pozycja z pliku ma tylko "Artysta" + "Tytuł"; tu dopisujemy release-group MBID,
 * żeby link z listy prowadził na stronę płyty (a stamtąd dalej w "podróż").
 *
 * NAJWAŻNIEJSZA RZECZ W TYM PLIKU: nieudane pytanie to nie to samo, co brak
 * płyty. Do niedawna każde niepowodzenie zapisywało datę próby i przez trzy dni
 * link szedł do wyszukiwarki — a że MusicBrainz miewał wtedy zadyszkę (503),
 * zapamiętywaliśmy jako „nie ma" płyty, które są. Skutek: klikasz w tytuł
 * z premier i zamiast płyty dostajesz wyszukiwarkę. Teraz awarię odróżniamy od
 * pustego wyniku i po awarii pytamy od nowa.
 */
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { findAlbumMbid, MbError, searchArtists } from "./musicbrainz";

/**
 * Jak długo nie wracamy do pozycji, której w MusicBrainz naprawdę nie ma.
 * Krócej niż dawne trzy dni: bazę uzupełniają ludzie, a premiera sprzed tygodnia
 * bywa dopisywana właśnie teraz.
 */
const RETRY_AFTER_MS = 1000 * 60 * 60 * 12;

/** Zwraca MBID albo null; `awaria` znaczy „nie wiemy", a nie „nie ma". */
async function znajdz(artist: string, album: string): Promise<{ mbid: string | null; awaria: boolean }> {
  try {
    const found = await findAlbumMbid(artist, album);
    return { mbid: found?.mbid ?? null, awaria: false };
  } catch (e) {
    // 503, limit zapytań, zerwane połączenie — o płycie nie dowiedzieliśmy się
    // niczego, więc nie wolno tego zapisać jako sprawdzone.
    if (e instanceof MbError) return { mbid: null, awaria: true };
    return { mbid: null, awaria: true };
  }
}

export async function resolveRelease(id: string): Promise<string | null> {
  const r = await db.query.releases.findFirst({ where: eq(schema.releases.id, id) });
  if (!r || !r.artist || !r.album) return null;
  if (r.mbid) return r.mbid;
  if (r.mbidTriedAt && Date.now() - r.mbidTriedAt.getTime() < RETRY_AFTER_MS) return null;
  const { mbid, awaria } = await znajdz(r.artist, r.album);
  if (awaria) return null; // bez zapisu — spróbujemy przy następnym kliknięciu
  await db
    .update(schema.releases)
    .set({ mbid, mbidTriedAt: new Date() })
    .where(eq(schema.releases.id, id))
    .catch(() => {});
  return mbid;
}

export async function resolveBestOf(id: string): Promise<string | null> {
  const r = await db.query.bestOfEntries.findFirst({ where: eq(schema.bestOfEntries.id, id) });
  if (!r) return null;
  if (r.mbid) return r.mbid;
  if (r.mbidTriedAt && Date.now() - r.mbidTriedAt.getTime() < RETRY_AFTER_MS) return null;
  const { mbid, awaria } = await znajdz(r.artist, r.album);
  if (awaria) return null;
  await db
    .update(schema.bestOfEntries)
    .set({ mbid, mbidTriedAt: new Date() })
    .where(eq(schema.bestOfEntries.id, id))
    .catch(() => {});
  return mbid;
}

/**
 * Gdy płyty nie ma w MusicBrainz — a to przy świeżych premierach normalne —
 * pytamy chociaż o ARTYSTĘ.
 *
 * Wysyłanie kogoś do wyszukiwarki jest wtedy podwójnie bez sensu: tam też nic
 * nie znajdzie, bo tej płyty po prostu nie ma. Strona artysty daje mu za to
 * jego pozostałe płyty i cały skład — czyli podróż, po którą przyszedł.
 */
export async function resolveArtistOnly(artist: string): Promise<string | null> {
  if (!artist.trim()) return null;
  const znalezieni = await searchArtists(artist, 1).catch(() => []);
  return znalezieni[0]?.mbid ?? null;
}
