import Link from "next/link";
import { poDniach, type JournalEvent } from "@/lib/journal";
import { formatDate, fmt } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import type { Dict } from "@/lib/dict";

/**
 * Dziennik podróży: co się tu wydarzyło, dzień po dniu.
 *
 * Etykieta zdarzenia mówi CO to było („polubiona płyta", „ocena 9/10"), a nie
 * co user zrobił — dziennik jest jego, więc „ja" byłoby w każdej linijce.
 * Dzięki temu wiersz czyta się jak wpis, nie jak log.
 */

function etykieta(e: JournalEvent, t: Dict): string {
  switch (e.kind) {
    case "stop":
      return t.lists.jStop;
    case "journey":
      return t.lists.jJourney;
    case "album":
      return e.sentiment === "dislike" ? t.lists.jAlbumDislike : t.lists.jAlbumLike;
    case "artist":
      return e.sentiment === "dislike" ? t.lists.jArtistDislike : t.lists.jArtistLike;
    case "rating":
      return fmt(t.lists.jRating, { score: e.score ?? "?" });
    case "comment":
      return t.lists.jComment;
    case "shared":
      return fmt(t.lists.jShared, { name: e.context ?? "" });
  }
}

/** Dziś i wczoraj po imieniu — reszta datą. Tak się czyta dziennik. */
function naglowekDnia(day: string, locale: Locale, t: Dict): string {
  const dzis = new Date();
  const wczoraj = new Date(dzis.getTime() - 86400000);
  const jako = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (day === jako(dzis)) return t.lists.journalToday;
  if (day === jako(wczoraj)) return t.lists.journalYesterday;
  return formatDate(day, locale);
}

export function TravelJournal({
  events,
  locale,
  t,
  more,
}: {
  events: JournalEvent[];
  locale: Locale;
  t: Dict;
  /** Adres pełnego dziennika — na stronie głównej pokazujemy tylko zajawkę. */
  more?: string;
}) {
  if (!events.length) return null;
  return (
    <section className="card" id="dziennik">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl">{t.lists.journalTitle}</h2>
        {more && <Link href={more} className="text-xs text-muted hover:text-accent2">{t.lists.journalAll} →</Link>}
      </div>
      <p className="mt-1 text-xs text-muted">{t.lists.journalNote}</p>
      <div className="mt-3 space-y-3">
        {poDniach(events).map(({ day, events: dnia }) => (
          <div key={day}>
            <h3 className="label mb-1">{naglowekDnia(day, locale, t)}</h3>
            {/* Pionowa kreska po lewej: dziennik ma wyglądać jak trasa, nie jak tabelka. */}
            <ul className="space-y-1.5 border-l border-rule pl-3">
              {dnia.map((e, i) => (
                <li key={`${e.kind}-${e.href ?? e.title}-${i}`} className="text-sm">
                  <span className="font-mono text-[10px] uppercase text-faint">{etykieta(e, t)}</span>{" "}
                  {e.href ? (
                    <Link href={e.href} className="hover:text-accent2 hover:underline">{e.title}</Link>
                  ) : (
                    <span className="text-text2">{e.title}</span>
                  )}
                  {e.kind === "stop" && e.context && (
                    <>
                      {" → "}
                      <Link href={e.contextHref ?? "#"} className="text-muted hover:text-accent2">{e.context}</Link>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
