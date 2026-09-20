import type { Links } from "@/lib/musicbrainz";
import type { ExternalRating } from "@/lib/externalRatings";
import { i18n } from "@/lib/t";
import { fmt } from "@/lib/i18n";
import { SerwisyPills } from "./serwisy";

/**
 * Pasek linków zewnętrznych — Spotify i Tidal zawsze, reszta gdy jest.
 *
 * `wikiUrl` to artykuł znaleziony okrężnie, przez Wikidatę. MusicBrainz przy
 * wielu zespołach (np. Squealer) trzyma tylko link do Wikidaty, więc pole
 * `links.wikipedia` bywa puste, choć artykuł istnieje i portal go czyta niżej,
 * w opisie. Bez tego w pasku brakowało Wikipedii dokładnie tam, gdzie widać ją
 * na tej samej stronie — wyglądało to na wycięty link.
 */
export async function LinksRow({
  links,
  compact = false,
  wikiUrl,
  mbid,
  typ,
  etykieta,
}: {
  links: Links;
  compact?: boolean;
  wikiUrl?: string | null;
  /** MBID płyty (release-group) albo artysty — bez niego zostaje wyszukiwanie */
  mbid?: string;
  typ?: "release-group" | "artist";
  /** „Artysta – Tytuł" albo sama nazwa — do szukania po nazwie i do wyszukiwarki */
  etykieta?: string;
}) {
  const { t } = await i18n();
  const { kvGetMany } = await import("@/lib/cache");
  const cls = compact ? "text-xs" : "text-sm";
  const wikipedia = links.wikipedia ?? wikiUrl ?? null;
  const dokladne = new Set(links.exact ?? []);
  const wynikiLinkow = mbid
    ? await kvGetMany<{ url: string | null }>([`link:spotify:${mbid}`, `link:tidal:${mbid}`]).catch(() => new Map())
    : new Map();
  /** true = mamy adres, false = wiemy, że go nie ma, undefined = nie sprawdzone */
  const stanSerwisu = (serwis: string) => {
    if (!mbid) return dokladne.has(serwis as never) ? true : false;
    const w = wynikiLinkow.get(`link:${serwis}:${mbid}`);
    return w ? !!w.url : dokladne.has(serwis as never) ? true : undefined;
  };

  /**
   * Ten sam znak co przy przystankach podróży, i z tego samego powodu.
   *
   * Część tych odnośników to PRAWDZIWE adresy z MusicBrainz, a część
   * wyszukiwania sklecone z nazwy — i dotąd wyglądały identycznie. Człowiek
   * klikał w „Bandcamp" spodziewając się płyty, a lądował w wyszukiwarce.
   * Teraz strzałka znaczy „wchodzisz prosto tam", lupka „to jest szukanie".
   */
  /**
   * Pigułki, a nie goły tekst — ten sam kształt co przy premierach.
   *
   * Wcześniej ten sam gest („posłuchaj tego") wyglądał na dwa sposoby
   * zależnie od ekranu: na premierach obwiedziony guzik, na stronie płyty
   * linijka tekstu. To samo znaczy to samo, więc ma wyglądać tak samo —
   * a przy okazji w guzik łatwiej trafić palcem na telefonie.
   *
   * Znak przed nazwą zostaje, bo niesie treść: strzałka to „wchodzisz prosto
   * tam", lupka to „to jest szukanie".
   */
  const pill = "rounded-full border px-3 py-1 font-mono transition-colors";
  const Odnosnik = ({ url, stan, nazwa, klasa }: { url: string; stan: boolean | undefined; nazwa: string; klasa: string }) => (
    <a
      href={url}
      target="_blank"
      rel="noopener"
      title={
        stan === true
          ? fmt(t.lists.openIn, { name: nazwa })
          : stan === false
            ? fmt(t.lists.onlySearch, { name: nazwa })
            : fmt(t.lists.notChecked, { name: nazwa })
      }
      className={`${pill} ${klasa}`}
    >
      {stan === true ? "▸" : stan === false ? "⌕" : "·"} {nazwa}
    </a>
  );

  return (
    <div className={`flex flex-wrap items-center gap-2 font-mono ${cls}`}>
      {/* Spotify i Tidal idą przez WSPÓLNY komponent — ten sam, co na
          premierach, półkach i w best of. Jeden guzik, jedna trasa, jeden
          zapis w dzienniku; patrz `components/serwisy.tsx`. */}
      <SerwisyPills
        etykieta={etykieta ?? ""}
        mbid={mbid}
        typ={typ ?? "release-group"}
        stanSpotify={stanSerwisu("spotify")}
        stanTidal={stanSerwisu("tidal")}
        tytul={(serwis, stan) => {
          const nazwa = serwis === "spotify" ? "Spotify" : "Tidal";
          return stan === true
            ? fmt(t.lists.openIn, { name: nazwa })
            : stan === false
              ? fmt(t.lists.onlySearch, { name: nazwa })
              : fmt(t.lists.notChecked, { name: nazwa });
        }}
        small={compact}
      />
      {links.bandcamp && <Odnosnik url={links.bandcamp} stan={dokladne.has("bandcamp")} nazwa="Bandcamp" klasa="border-rule text-muted hover:border-accent2 hover:text-accent2" />}
      {links.metalArchives && <Odnosnik url={links.metalArchives} stan={dokladne.has("metalArchives")} nazwa="Metal-Archives" klasa="border-rule text-muted hover:border-accent2 hover:text-accent2" />}
      {links.allmusic && <Odnosnik url={links.allmusic} stan={dokladne.has("allmusic")} nazwa="AllMusic" klasa="border-rule text-muted hover:border-accent2 hover:text-accent2" />}
      {links.discogs && <Odnosnik url={links.discogs} stan={dokladne.has("discogs")} nazwa="Discogs" klasa="border-rule text-muted hover:border-accent2 hover:text-accent2" />}
      {wikipedia && <Odnosnik url={wikipedia} stan={true} nazwa="Wikipedia" klasa="border-rule text-muted hover:border-accent2 hover:text-accent2" />}
      {links.official && <Odnosnik url={links.official} stan={true} nazwa="www" klasa="border-rule text-muted hover:border-accent2 hover:text-accent2" />}
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
      <div className="flex flex-wrap items-center gap-2 font-mono text-sm">
        {items.map((i) => {
          const r = byLabel.get(i.label);
          return (
            <div key={i.label} className="flex items-center gap-1.5">
              {/* Ten sam znak co wszędzie: strzałka prowadzi prosto,
                  lupka do wyszukiwania. */}
              <a
                href={i.href}
                target="_blank"
                rel="noopener"
                title={dokladne.has(i.klucz as never) ? fmt(t.lists.openIn, { name: i.label }) : fmt(t.lists.onlySearch, { name: i.label })}
                className="rounded-full border border-rule px-3 py-1 text-muted transition-colors hover:border-accent2 hover:text-accent2"
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
 * USUNIĘTE: `searchLinks`.
 *
 * Budowało adresy do serwisów na boku — Spotify przez własną trasę, Tidala
 * prosto w wyszukiwarkę. Efekt: przyciski przy premierach i w best of
 * wyglądały jak pozostałe, ale nie zapisywały wyjścia w dzienniku, a Tidal
 * z zasady lądował w wyszukiwarce. Wszystkie te miejsca używają teraz
 * wspólnego `SerwisyPills` (components/serwisy.tsx).
 */
