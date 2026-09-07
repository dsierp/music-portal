/**
 * Łączenie pozycji z list (premiery, best of) z MusicBrainz.
 * Pozycja z pliku ma tylko "Artysta" + "Tytuł"; tu dopisujemy release-group MBID,
 * żeby link z listy prowadził na stronę płyty (a stamtąd dalej w "podróż").
 */
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { findAlbumMbid } from "./musicbrainz";

const RETRY_AFTER_MS = 1000 * 60 * 60 * 24 * 3;

export async function resolveRelease(id: string): Promise<string | null> {
  const r = await db.query.releases.findFirst({ where: eq(schema.releases.id, id) });
  if (!r || !r.artist || !r.album) return null;
  if (r.mbid) return r.mbid;
  if (r.mbidTriedAt && Date.now() - r.mbidTriedAt.getTime() < RETRY_AFTER_MS) return null;
  const found = await findAlbumMbid(r.artist, r.album).catch(() => null);
  await db.update(schema.releases).set({ mbid: found?.mbid ?? null, mbidTriedAt: new Date() }).where(eq(schema.releases.id, id));
  return found?.mbid ?? null;
}

export async function resolveBestOf(id: string): Promise<string | null> {
  const r = await db.query.bestOfEntries.findFirst({ where: eq(schema.bestOfEntries.id, id) });
  if (!r) return null;
  if (r.mbid) return r.mbid;
  if (r.mbidTriedAt && Date.now() - r.mbidTriedAt.getTime() < RETRY_AFTER_MS) return null;
  const found = await findAlbumMbid(r.artist, r.album).catch(() => null);
  await db.update(schema.bestOfEntries).set({ mbid: found?.mbid ?? null, mbidTriedAt: new Date() }).where(eq(schema.bestOfEntries.id, id));
  return found?.mbid ?? null;
}
