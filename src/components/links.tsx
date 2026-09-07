import type { Links } from "@/lib/musicbrainz";

/** Pasek linków zewnętrznych — Spotify i Tidal zawsze, reszta gdy jest. */
export function LinksRow({ links, compact = false }: { links: Links; compact?: boolean }) {
  const cls = compact ? "text-xs" : "text-sm";
  return (
    <div className={`flex flex-wrap gap-x-4 gap-y-1 font-mono ${cls}`}>
      <a href={links.spotify} target="_blank" rel="noopener" className="text-spotify hover:text-spotify hover:underline">▶ Spotify</a>
      <a href={links.tidal} target="_blank" rel="noopener" className="text-tidal hover:text-tidal hover:underline">▶ Tidal</a>
      {links.bandcamp && <a href={links.bandcamp} target="_blank" rel="noopener" className="text-text2 hover:underline">Bandcamp</a>}
      {links.metalArchives && <a href={links.metalArchives} target="_blank" rel="noopener" className="text-text2 hover:underline">Metal-Archives</a>}
      {links.allmusic && <a href={links.allmusic} target="_blank" rel="noopener" className="text-text2 hover:underline">AllMusic</a>}
      {links.discogs && <a href={links.discogs} target="_blank" rel="noopener" className="text-text2 hover:underline">Discogs</a>}
      {links.wikipedia && <a href={links.wikipedia} target="_blank" rel="noopener" className="text-text2 hover:underline">Wikipedia</a>}
      {links.official && <a href={links.official} target="_blank" rel="noopener" className="text-text2 hover:underline">www</a>}
    </div>
  );
}

/** Linki wyszukiwania dla pozycji bez MBID (premiery, best of). */
export function searchLinks(artist: string, album: string): Links {
  const q = encodeURIComponent(`${artist} ${album}`);
  return { spotify: `https://open.spotify.com/search/${q}`, tidal: `https://listen.tidal.com/search?q=${q}` };
}
