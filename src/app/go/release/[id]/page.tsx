import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { resolveArtistOnly, resolveRelease } from "@/lib/resolve";

/** Z listy premier na stronę płyty (rozwiązanie MBID w locie). */
export default async function GoRelease({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mbid = await resolveRelease(decodeURIComponent(id));
  if (mbid) redirect(`/album/${mbid}`);
  const r = await db.query.releases.findFirst({ where: eq(schema.releases.id, decodeURIComponent(id)) });
  // Świeżej premiery często nie ma jeszcze w MusicBrainz. Wtedy wyszukiwarka
  // niczego nie da — ale artysta zwykle w bazie JEST, a na jego stronie jest
  // wszystko, po co się tu przyszło.
  const artysta = r?.artist ? await resolveArtistOnly(r.artist) : null;
  if (artysta) redirect(`/artist/${artysta}?brak=${encodeURIComponent(r?.album ?? "")}`);
  redirect(`/szukaj?q=${encodeURIComponent(`${r?.artist ?? ""} ${r?.album ?? ""}`)}&miss=1`);
}
