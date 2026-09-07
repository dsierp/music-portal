import { rate } from "@/app/actions";
import type { RatingSummary } from "@/lib/user-data";
import type { Target } from "@/lib/user-data";

export function RatingBadge({ avg, count }: { avg: number | null; count: number }) {
  if (!count) return <span className="font-mono text-xs text-faint">bez ocen</span>;
  return (
    <span className="font-mono text-xs text-text2" title={`${count} ocen`}>
      <span className="text-accent2 text-sm font-medium">{avg?.toFixed(1)}</span>/10 · {count}
    </span>
  );
}

/** Oceny: zbiorczo (średnia, rozkład) + własna ocena 1–10. */
export function RatingPanel({ type, mbid, summary, loggedIn, label }: { type: Target; mbid: string; summary: RatingSummary; loggedIn: boolean; label: string }) {
  const max = Math.max(1, ...summary.histogram);
  return (
    <section className="card">
      <div className="flex items-baseline justify-between">
        <h3 className="text-lg">Oceny</h3>
        <RatingBadge avg={summary.avg} count={summary.count} />
      </div>
      {summary.count > 0 && (
        <div className="mt-3 flex h-12 items-end gap-0.5" aria-label="rozkład ocen">
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
        <div className="label mb-1">{summary.mine ? `Twoja ocena: ${summary.mine}/10` : "Twoja ocena"}</div>
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
              <button name="score" value="" className="ml-2 text-xs text-muted hover:text-accent2">usuń</button>
            )}
          </div>
        ) : (
          <a href="/login" className="text-sm text-muted hover:text-accent2">Zaloguj się, żeby ocenić.</a>
        )}
      </form>
    </section>
  );
}
