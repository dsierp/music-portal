import type { Links } from "@/lib/musicbrainz";
import type { ExternalRating } from "@/lib/externalRatings";
import { i18n } from "@/lib/t";

/**
 * Pasek linków zewnętrznych — Spotify i Tidal zawsze, reszta gdy jest.
 *
 * `wikiUrl` to artykuł znaleziony okrężnie, przez Wikidatę. MusicBrainz przy
 * wielu zespołach (np. Squealer) trzyma tylko link do Wikidaty, więc pole
 * `links.wikipedia` bywa puste, choć artykuł istnieje i portal go czyta niżej,
 * w opisie. Bez tego w pasku brakowało Wikipedii dokładnie tam, gdzie widać ją
 * na tej samej stronie — wyglądało to na wycięty link.
 */
export function LinksRow({ links, compact = false, wikiUrl }: { links: Links; compact?: boolean; wikiUrl?: string | null }) {
  const cls = compact ? "text-xs" : "text-sm";
  const wikipedia = links.wikipedia ?? wikiUrl ?? null;
  return (
    <div className={`flex flex-wrap gap-x-4 gap-y-1 font-mono ${cls}`}>
      <a href={links.spotify} target="_blank" rel="noopener" className="text-spotify hover:text-spotify hover:underline">▶ Spotify</a>
      <a href={links.tidal} target="_blank" rel="noopener" className="text-tidal hover:text-tidal hover:underline">▶ Tidal</a>
      {links.bandcamp && <a href={links.bandcamp} target="_blank" rel="noopener" className="text-text2 hover:underline">Bandcamp</a>}
      {links.metalArchives && <a href={links.metalArchives} target="_blank" rel="noopener" className="text-text2 hover:underline">Metal-Archives</a>}
      {links.allmusic && <a href={links.allmusic} target="_blank" rel="noopener" className="text-text2 hover:underline">AllMusic</a>}
      {links.discogs && <a href={links.discogs} target="_blank" rel="noopener" className="text-text2 hover:underline">Discogs</a>}
      {wikipedia && <a href={wikipedia} target="_blank" rel="noopener" className="text-text2 hover:underline">Wikipedia</a>}
      {links.official && <a href={links.official} target="_blank" rel="noopener" className="text-text2 hover:underline">www</a>}
    </div>
  );
}

/**
 * Oceny i recenzje zewnętrzne — osobno od "gdzie słuchać", bo to inny cel kliknięcia.
 * `ratings` (opcjonalne, patrz externalRatings.ts) dokłada faktyczną liczbę przy
 * serwisach, dla których udało się ją wyciągnąć — best-effort, więc część linków
 * i tak zostanie samym linkiem.
 */
export async function ReviewLinks({ links, ratings }: { links: Links; ratings?: ExternalRating[] }) {
  const { t } = await i18n();
  const byLabel = new Map((ratings ?? []).map((r) => [r.source, r]));
  const items: { href?: string; label: string }[] = [
    { href: links.rateYourMusic, label: "RateYourMusic" },
    { href: links.albumOfTheYear, label: "Album of the Year" },
    { href: links.sputnikmusic, label: "Sputnikmusic" },
    { href: links.progArchives, label: "ProgArchives" },
    { href: links.metalArchives, label: "Metal-Archives" },
    { href: links.allmusic, label: "AllMusic" },
    { href: links.discogs, label: "Discogs" },
  ].filter((i) => i.href);
  if (!items.length) return null;
  return (
    <div>
      <h3 className="label mb-1">{t.common.reviewsTitle}</h3>
      <div className="flex flex-col gap-1 font-mono text-sm">
        {items.map((i) => {
          const r = byLabel.get(i.label);
          return (
            <div key={i.label} className="flex flex-wrap items-baseline gap-x-2">
              <a href={i.href} target="_blank" rel="noopener" className="text-text2 hover:text-accent2 hover:underline">
                {i.label} ↗
              </a>
              {r && (
                <span className="text-accent2">
                  {r.display}
                  {r.count != null && <span className="text-faint"> ({r.count})</span>}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {ratings && items.some((i) => !byLabel.get(i.label)) && (
        <p className="mt-1 text-[10px] text-faint">{t.common.reviewsAutoNote}</p>
      )}
    </div>
  );
}

/** Linki wyszukiwania dla pozycji bez MBID (premiery, best of). */
export function searchLinks(artist: string, album: string): Links {
  const q = encodeURIComponent(`${artist} ${album}`);
  return { spotify: `https://open.spotify.com/search/${q}`, tidal: `https://listen.tidal.com/search?q=${q}` };
}
