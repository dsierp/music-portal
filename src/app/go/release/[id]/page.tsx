import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { resolveRelease } from "@/lib/resolve";

/** Z listy premier na stronę płyty (rozwiązanie MBID w locie). */
export default async function GoRelease({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mbid = await resolveRelease(decodeURIComponent(id));
  if (mbid) redirect(`/album/${mbid}`);
  const r = await db.query.releases.findFirst({ where: eq(schema.releases.id, decodeURIComponent(id)) });
  redirect(`/szukaj?q=${encodeURIComponent(`${r?.artist ?? ""} ${r?.album ?? ""}`)}&miss=1`);
}
