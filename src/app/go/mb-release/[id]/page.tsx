import { notFound, redirect } from "next/navigation";
import { releaseGroupOfRelease } from "@/lib/musicbrainz";

/**
 * Wydanie (release) → strona płyty (release-group).
 *
 * Relacje produkcyjne w MusicBrainz wskazują konkretne WYDANIE, a nasze strony
 * płyt stoją na release-group. Tłumaczymy jedno na drugie dopiero po kliknięciu:
 * producent bywa podpisany pod setką wydań, a rozwiązywanie ich wszystkich przy
 * wyświetlaniu listy kosztowałoby setkę zapytań (MusicBrainz: 1 na sekundę).
 */
export const dynamic = "force-dynamic";

export default async function GoMbRelease({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rg = await releaseGroupOfRelease(decodeURIComponent(id)).catch(() => null);
  if (!rg) notFound();
  redirect(`/album/${rg}`);
}
