import type { Links } from "@/lib/musicbrainz";
import type { WikiReview } from "@/lib/wikitext";
import type { ExternalRating } from "@/lib/externalRatings";

/**
 * Oceny płyty — na wierzchu, zaraz pod nagłówkiem, bo po to się tu wchodzi.
 *
 * Trzy źródła, w kolejności od najpewniejszego:
 *  1. ocena społeczności MusicBrainz (zawsze dostępna, bez scrapowania),
 *  2. oceny prasowe z infoboksu Wikipedii (AllMusic, Pitchfork, Sputnik…),
 *  3. to, co udało się wyciągnąć wprost ze stron z recenzjami (rzadkie —
 *     RateYourMusic i AlbumOfTheYear blokują automaty).
 * Gdy nie ma żadnej — mówimy to wprost i zostawiamy linki do sprawdzenia.
 */
export function RatingsBar({
  mbRating,
  press,
  external,
  links,
}: {
  mbRating: { value: number; votes: number } | null;
  press: WikiReview[];
  external: ExternalRating[];
  links: Links;
}) {
  const hasAny = !!mbRating || press.length > 0 || external.length > 0;
  return (
    <section className="mt-5">
      <h2 className="label mb-2">Oceny</h2>
      {hasAny ? (
        <div className="flex flex-wrap items-stretch gap-2">
          {mbRating && (
            <Box label="MusicBrainz" value={`${mbRating.value}/5`} note={`${mbRating.votes} ${plGlosy(mbRating.votes)}`} />
          )}
          {press.map((r) => (
            <Box key={`p-${r.source}`} label={r.source} value={r.score} note="prasa" />
          ))}
          {external.map((r) => (
            <Box key={`e-${r.source}`} label={r.source} value={r.display} note={r.count != null ? `${r.count} ocen` : undefined} href={r.url} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">
          Nie znaleźliśmy ocen dla tej płyty — ani w MusicBrainz, ani w infoboksie na Wikipedii.{" "}
          {links.rateYourMusic && (
            <a href={links.rateYourMusic} target="_blank" rel="noopener" className="underline hover:text-accent2">
              Sprawdź na RateYourMusic ↗
            </a>
          )}
        </p>
      )}
      {press.length > 0 && <p className="mt-1 text-[10px] text-faint">Oceny prasowe: infobox Wikipedii.</p>}
    </section>
  );
}

function plGlosy(n: number) {
  if (n === 1) return "głos";
  const last = n % 10;
  const teen = n % 100 >= 12 && n % 100 <= 14;
  return !teen && last >= 2 && last <= 4 ? "głosy" : "głosów";
}

function Box({ label, value, note, href }: { label: string; value: string; note?: string; href?: string }) {
  const inner = (
    <>
      <div className="font-mono text-lg leading-none text-accent2">{value}</div>
      <div className="mt-1 text-xs text-text2">{label}</div>
      {note && <div className="font-mono text-[10px] text-faint">{note}</div>}
    </>
  );
  const cls = "rounded border border-rule/60 px-3 py-2 text-center";
  return href ? (
    <a href={href} target="_blank" rel="noopener" className={`${cls} hover:border-accent2`}>
      {inner}
    </a>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
