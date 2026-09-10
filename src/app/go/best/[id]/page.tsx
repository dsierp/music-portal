import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { resolveArtistOnly, resolveBestOf } from "@/lib/resolve";

export default async function GoBest({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mbid = await resolveBestOf(id);
  if (mbid) redirect(`/album/${mbid}`);
  const r = await db.query.bestOfEntries.findFirst({ where: eq(schema.bestOfEntries.id, id) });
  const artysta = r?.artist ? await resolveArtistOnly(r.artist) : null;
  if (artysta) redirect(`/artist/${artysta}?brak=${encodeURIComponent(r?.album ?? "")}`);
  redirect(`/szukaj?q=${encodeURIComponent(`${r?.artist ?? ""} ${r?.album ?? ""}`)}&miss=1`);
}
