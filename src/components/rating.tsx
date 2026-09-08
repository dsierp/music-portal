import { rate } from "@/app/actions";
import type { RatingSummary } from "@/lib/user-data";
import type { Target } from "@/lib/user-data";
import { i18n } from "@/lib/t";
import { fmt, plural } from "@/lib/i18n";

/**
 * Używana też w cards.tsx (poza moim zakresem plików) — tam bez oczekiwania
 * na locale, więc woła i18n() sama. Bezpieczne: to komponent serwerowy,
 * a Next renderuje async komponenty w drzewie bez jawnego await w rodzicu.
 */
export async function RatingBadge({ avg, count }: { avg: number | null; count: number }) {
  const { locale, t } = await i18n();
  if (!count) return <span className="font-mono text-xs text-faint">{t.common.noRatings}</span>;
  return (
    <span className="font-mono text-xs text-text2" title={plural(locale, count, t.common.ratingsCount)}>
      <span className="text-accent2 text-sm font-medium">{avg?.toFixed(1)}</span>/10 · {count}
    </span>
  );
}

/** Oceny: zbiorczo (średnia, rozkład) + własna ocena 1–10. Tylko na stronach artysty i płyty. */
export async function RatingPanel({ type, mbid, summary, loggedIn, label }: { type: Target; mbid: string; summary: RatingSummary; loggedIn: boolean; label: string }) {
  const { t } = await i18n();
  const max = Math.max(1, ...summary.histogram);
  return (
    <section className="card">
      <div className="flex items-baseline justify-between">
        <h3 className="text-lg">{t.common.ratingsPanelTitle}</h3>
        <RatingBadge avg={summary.avg} count={summary.count} />
      </div>
      {summary.count > 0 && (
        <div className="mt-3 flex h-12 items-end gap-0.5" aria-label={t.common.ratingsPanelTitle}>
          {summary.histogram.slice(1).map((n, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-0.5" title={`${i + 1}: ${n}`}>
              <div className="w-full rounded-sm bg-accent/70" style={{ height: `${Math.max(2, (n / max) * 36)}px` }} />
              <span className="font-mono text-[9px] text-faint">{i + 1}</span>
            </div>
          ))}
        </div>
      )}
      <form action={rate} className="mt-3">
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="mbid" value={mbid} />
        <input type="hidden" name="label" value={label} />
        <div className="label mb-1">{summary.mine ? fmt(t.common.yourRatingValue, { n: summary.mine }) : t.common.yourRating}</div>
        {loggedIn ? (
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                name="score"
                value={n}
                className={`h-8 w-8 rounded border font-mono text-sm ${summary.mine === n ? "border-accent bg-accent text-white" : "border-rule bg-surface2 hover:border-accent"}`}
              >
                {n}
              </button>
            ))}
            {summary.mine && (
              <button name="score" value="" className="ml-2 text-xs text-muted hover:text-accent2">{t.common.removeAction}</button>
            )}
          </div>
        ) : (
          <a href="/login" className="text-sm text-muted hover:text-accent2">{t.common.loginToRate}</a>
        )}
      </form>
    </section>
  );
}
