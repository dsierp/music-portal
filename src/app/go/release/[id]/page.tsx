import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { resolveArtistOnly, resolveRelease } from "@/lib/resolve";
import { GoFail } from "@/components/go-fail";
import { i18n } from "@/lib/t";

/** Z listy premier na stronę płyty (rozwiązanie MBID w locie). */
export default async function GoRelease({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const klucz = decodeURIComponent(id);
  const mbid = await resolveRelease(klucz);
  if (mbid) redirect(`/album/${mbid}`);
  const r = await db.query.releases.findFirst({ where: eq(schema.releases.id, klucz) });
  // Świeżej premiery często nie ma jeszcze w MusicBrainz. Wtedy wyszukiwarka
  // niczego nie da — ale artysta zwykle w bazie JEST, a na jego stronie jest
  // wszystko, po co się tu przyszło.
  const artysta = r?.artist ? await resolveArtistOnly(r.artist) : null;
  if (artysta) redirect(`/artist/${artysta}?brak=${encodeURIComponent(r?.album ?? "")}`);
  const { t } = await i18n();
  return <GoFail artist={r?.artist ?? ""} album={r?.album ?? ""} retryHref={`/go/release/${id}`} t={t} />;
}
