import Link from "next/link";
import type { AlbumSummary, CreditPart } from "@/lib/musicbrainz";
import { RatingBadge } from "./rating";
import { Cover } from "./cover";

export function CreditLinks({ credit, className = "" }: { credit: CreditPart[]; className?: string }) {
  return (
    <span className={className}>
      {credit.map((p, i) => (
        <span key={i}>
          <Link href={`/artist/${p.mbid}`} className="hover:text-accent2 hover:underline">{p.name}</Link>
          {p.join}
        </span>
      ))}
    </span>
  );
}

/**
 * `fallback` przychodzi od wywołującego, bo ten komponent współdzielą ekrany
 * spoza tego zestawu plików (płyta, artysta, szukaj) — nie narzucamy im tu
 * własnego słownika, tylko dajemy sensowną wartość domyślną po polsku.
 */
export function typeLabel(a: AlbumSummary, fallback = "wydawnictwo") {
  const t = [a.primaryType, ...a.secondaryTypes].filter(Boolean).join(" · ");
  return t || fallback;
}

export function AlbumCard({ album, rating, extra }: { album: AlbumSummary; rating?: { avg: number; count: number }; extra?: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-lg border border-rule bg-surface p-3">
      <Link href={`/album/${album.mbid}`} className="shrink-0"><Cover mbid={album.mbid} size={64} /></Link>
      <div className="min-w-0">
        <Link href={`/album/${album.mbid}`} className="display block truncate text-lg font-semibold hover:text-accent2">{album.title}</Link>
        <div className="truncate text-sm text-text2"><CreditLinks credit={album.credit} /></div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 font-mono text-xs text-muted">
          {album.year && <span>{album.year}</span>}
          <span>{typeLabel(album)}</span>
          {rating && <RatingBadge avg={rating.avg} count={rating.count} />}
        </div>
        {extra}
      </div>
    </div>
  );
}

export function ArtistCard({ mbid, name, sub, extra }: { mbid: string; name: string; sub?: string | null; extra?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-rule bg-surface p-3">
      <Link href={`/artist/${mbid}`} className="display text-lg font-semibold hover:text-accent2">{name}</Link>
      {sub && <div className="text-xs text-muted">{sub}</div>}
      {extra}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded border border-dashed border-rule p-4 text-sm text-muted">{children}</p>;
}
