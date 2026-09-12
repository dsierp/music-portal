import type { Links } from "@/lib/musicbrainz";
import type { ExternalRating } from "@/lib/externalRatings";
import { i18n } from "@/lib/t";
import { fmt } from "@/lib/i18n";

/**
 * Pasek linków zewnętrznych — Spotify i Tidal zawsze, reszta gdy jest.
 *
 * `wikiUrl` to artykuł znaleziony okrężnie, przez Wikidatę. MusicBrainz przy
 * wielu zespołach (np. Squealer) trzyma tylko link do Wikidaty, więc pole
 * `links.wikipedia` bywa puste, choć artykuł istnieje i portal go czyta niżej,
 * w opisie. Bez tego w pasku brakowało Wikipedii dokładnie tam, gdzie widać ją
 * na tej samej stronie — wyglądało to na wycięty link.
 */
export async function LinksRow({ links, compact = false, wikiUrl }: { links: Links; compact?: boolean; wikiUrl?: string | null }) {
  const { t } = await i18n();
  const cls = compact ? "text-xs" : "text-sm";
  const wikipedia = links.wikipedia ?? wikiUrl ?? null;
  const dokladne = new Set(links.exact ?? []);

  /**
   * Ten sam znak co przy przystankach podróży, i z tego samego powodu.
   *
   * Część tych odnośników to PRAWDZIWE adresy z MusicBrainz, a część
   * wyszukiwania sklecone z nazwy — i dotąd wyglądały identycznie. Człowiek
   * klikał w „Bandcamp" spodziewając się płyty, a lądował w wyszukiwarce.
   * Teraz strzałka znaczy „wchodzisz prosto tam", lupka „to jest szukanie".
   */
  const Odnosnik = ({ url, klucz, nazwa, klasa }: { url: string; klucz: string; nazwa: string; klasa: string }) => {
    const wprost = dokladne.has(klucz as never);
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener"
        title={wprost ? fmt(t.lists.openIn, { name: nazwa }) : fmt(t.lists.onlySearch, { name: nazwa })}
        className={`${klasa} hover:underline`}
      >
        {wprost ? "▸" : "⌕"} {nazwa}
      </a>
    );
  };

  return (
    <div className={`flex flex-wrap gap-x-4 gap-y-1 font-mono ${cls}`}>
      <Odnosnik url={links.spotify} klucz="spotify" nazwa="Spotify" klasa="text-spotify hover:text-spotify" />
      <Odnosnik url={links.tidal} klucz="tidal" nazwa="Tidal" klasa="text-tidal hover:text-tidal" />
      {links.bandcamp && <Odnosnik url={links.bandcamp} klucz="bandcamp" nazwa="Bandcamp" klasa="text-text2" />}
      {links.metalArchives && <Odnosnik url={links.metalArchives} klucz="metalArchives" nazwa="Metal-Archives" klasa="text-text2" />}
      {links.allmusic && <Odnosnik url={links.allmusic} klucz="allmusic" nazwa="AllMusic" klasa="text-text2" />}
      {links.discogs && <Odnosnik url={links.discogs} klucz="discogs" nazwa="Discogs" klasa="text-text2" />}
      {wikipedia && <Odnosnik url={wikipedia} klucz="wikipedia" nazwa="Wikipedia" klasa="text-text2" />}
      {links.official && <Odnosnik url={links.official} klucz="official" nazwa="www" klasa="text-text2" />}
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
  const dokladne = new Set(links.exact ?? []);
  const items: { href?: string; label: string; klucz: string }[] = [
    { href: links.rateYourMusic, label: "RateYourMusic", klucz: "rateYourMusic" },
    { href: links.albumOfTheYear, label: "Album of the Year", klucz: "albumOfTheYear" },
    { href: links.sputnikmusic, label: "Sputnikmusic", klucz: "sputnikmusic" },
    { href: links.progArchives, label: "ProgArchives", klucz: "progArchives" },
    { href: links.metalArchives, label: "Metal-Archives", klucz: "metalArchives" },
    { href: links.allmusic, label: "AllMusic", klucz: "allmusic" },
    { href: links.discogs, label: "Discogs", klucz: "discogs" },
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
              {/* Ten sam znak co wszędzie: strzałka prowadzi prosto,
                  lupka do wyszukiwania. */}
              <a
                href={i.href}
                target="_blank"
                rel="noopener"
                title={dokladne.has(i.klucz as never) ? fmt(t.lists.openIn, { name: i.label }) : fmt(t.lists.onlySearch, { name: i.label })}
                className="text-text2 hover:text-accent2 hover:underline"
              >
                {dokladne.has(i.klucz as never) ? "▸" : "⌕"} {i.label}
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

/**
 * Linki dla pozycji bez MBID (premiery, best of).
 *
 * Spotify prowadzi przez naszą trasę, która dopiero przy kliknięciu szuka
 * konkretnej płyty — na stronie z premierami jest ich kilkadziesiąt, a kwota
 * aplikacji nie zniosłaby pytania o wszystkie z góry.
 */
export function searchLinks(artist: string, album: string): Links {
  const q = encodeURIComponent(`${artist} ${album}`);
  return {
    spotify: `/go/spotify?artist=${encodeURIComponent(artist)}&album=${encodeURIComponent(album)}`,
    tidal: `https://listen.tidal.com/search?q=${q}`,
  };
}
