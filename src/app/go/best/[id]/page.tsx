import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { resolveArtistOnly, resolveBestOf } from "@/lib/resolve";
import { GoFail } from "@/components/go-fail";
import { i18n } from "@/lib/t";

/** Z rankingu best of na stronę płyty (rozwiązanie MBID w locie). */
export default async function GoBest({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mbid = await resolveBestOf(id);
  if (mbid) redirect(`/album/${mbid}`);
  const r = await db.query.bestOfEntries.findFirst({ where: eq(schema.bestOfEntries.id, id) });
  const artysta = r?.artist ? await resolveArtistOnly(r.artist) : null;
  if (artysta) redirect(`/artist/${artysta}?brak=${encodeURIComponent(r?.album ?? "")}`);
  const { t } = await i18n();
  return <GoFail artist={r?.artist ?? ""} album={r?.album ?? ""} retryHref={`/go/best/${id}`} t={t} />;
}
