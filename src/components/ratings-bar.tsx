import type { Links } from "@/lib/musicbrainz";
import type { WikiReview } from "@/lib/wikitext";
import type { ExternalRating } from "@/lib/externalRatings";
import { i18n } from "@/lib/t";
import { plural } from "@/lib/i18n";

/**
 * Oceny płyty — na wierzchu, zaraz pod nagłówkiem, bo po to się tu wchodzi.
 *
 * Trzy źródła, w kolejności od najpewniejszego:
 *  1. ocena społeczności MusicBrainz (zawsze dostępna, bez scrapowania),
 *  2. oceny prasowe z infoboksu Wikipedii (AllMusic, Pitchfork, Sputnik…),
 *  3. to, co udało się wyciągnąć wprost ze stron z recenzjami (rzadkie —
 *     RateYourMusic i AlbumOfTheYear blokują automaty).
 * Gdy nie ma żadnej — mówimy to wprost i zostawiamy linki do sprawdzenia.
 *
 * Tylko na stronie płyty — woła i18n() sama.
 */
export async function RatingsBar({
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
  const { locale, t } = await i18n();
  const hasAny = !!mbRating || press.length > 0 || external.length > 0;
  return (
    <section className="mt-5">
      <h2 className="label mb-2">{t.common.ratingsPanelTitle}</h2>
      {hasAny ? (
        <div className="flex flex-wrap items-stretch gap-2">
          {mbRating && (
            <Box label="MusicBrainz" value={`${mbRating.value}/5`} note={plural(locale, mbRating.votes, t.album.mbVotes)} />
          )}
          {press.map((r) => (
            <Box key={`p-${r.source}`} label={r.source} value={r.score} note={t.album.pressNote} />
          ))}
          {external.map((r) => (
            <Box key={`e-${r.source}`} label={r.source} value={r.display} note={r.count != null ? plural(locale, r.count, t.common.ratingsCount) : undefined} href={r.url} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">
          {t.album.noRatingsFound}{" "}
          {links.rateYourMusic && (
            <a href={links.rateYourMusic} target="_blank" rel="noopener" className="underline hover:text-accent2">
              {t.album.checkOnRym} ↗
            </a>
          )}
        </p>
      )}
      {press.length > 0 && <p className="mt-1 text-[10px] text-faint">{t.album.pressSourceNote}</p>}
    </section>
  );
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
