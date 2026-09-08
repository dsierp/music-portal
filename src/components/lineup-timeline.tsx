import type { AlbumSummary, Membership } from "@/lib/musicbrainz";
import { fillMissingSpans, mergeSpans, rowRoles, type TimelineRow } from "@/lib/timeline";
import { fmt, plural, type Locale } from "@/lib/i18n";
import type { Dict } from "@/lib/dict";

/**
 * Oś czasu — dwa spojrzenia na to samo:
 *
 *  • zespół: po lewej ludzie, paski to okresy grania w składzie (`LineupTimeline`),
 *  • człowiek: po lewej zespoły, paski to okresy członkostwa (`CareerTimeline`).
 *
 * Rysowane z danych, które strona i tak już ma: członkostwa z MusicBrainz (mają
 * daty od–do i instrumenty) plus dyskografia. Zero dodatkowych zapytań.
 *
 * Czyta się z nich to, czego nie widać z listy nazwisk: ile trwały składy, które
 * płyty nagrał który skład, gdzie zespół się rozsypywał — a przy muzyku: kiedy
 * grał w dwóch miejscach naraz i co wtedy nagrywał.
 *
 * WAŻNE: jeden wiersz to jedna osoba (albo jeden zespół), nawet jeśli MusicBrainz
 * ma kilka osobnych członkostw — Tony Choy odchodził i wracał do Atheist cztery
 * razy i przez to zajmował cztery wiersze, choć to wciąż ten sam basista. Odcinki
 * scalamy w jeden wiersz, przerwy zostają widoczne jako luki między paskami.
 *
 * Rysujemy inline SVG: skaluje się bez rozmycia, działa bez javascriptu i nie
 * wymaga żadnej biblioteki.
 *
 * Napisy (legenda, podpisy, stopka) przychodzą propsami ze strony artysty
 * (patrz `TimelineLabels` niżej) — komponent sam nie woła i18n(), żeby jego API
 * pozostało czystą funkcją danych + etykiet, bez ukrytej zależności od żądania.
 */
type TimelineLabels = Dict["artist"]["timeline"];

/** Kolejność dopasowania ma znaczenie — pierwsza pasująca rola wygrywa (np. "bas" przed "inne"). */
function roleColors(t: TimelineLabels): { match: RegExp; color: string; label: string }[] {
  return [
    { match: /vocal|voice|śpiew/i, color: "#d6392f", label: t.roleVocal },
    { match: /guitar|gitar/i, color: "#5aa84f", label: t.roleGuitar },
    { match: /bass|bas\b/i, color: "#5b8fd6", label: t.roleBass },
    { match: /drum|perkus|percussion/i, color: "#e0913f", label: t.roleDrums },
    { match: /key|piano|organ|synth/i, color: "#a071c9", label: t.roleKeys },
  ];
}

function roleStyle(roles: string[], t: TimelineLabels) {
  for (const r of roles) {
    const hit = roleColors(t).find((c) => c.match.test(r));
    if (hit) return hit;
  }
  return { color: "#7c8296", label: t.roleOther };
}

/** "1983-04-01" → 1983.25; null → domyślna wartość. */
function toYear(date: string | null | undefined, fallback: number): number {
  if (!date) return fallback;
  const y = Number(date.slice(0, 4));
  if (!Number.isFinite(y)) return fallback;
  const m = Number(date.slice(5, 7));
  return y + (Number.isFinite(m) && m > 0 ? (m - 1) / 12 : 0);
}

/** Znacznik płyty na osi — przy wierszu (płyta danego zespołu) albo globalny. */
interface Mark {
  mbid: string;
  title: string;
  artistText: string;
  year: string | null;
  date: string | null;
}
type Row = TimelineRow<Mark>;

function markOf(a: AlbumSummary): Mark {
  return { mbid: a.mbid, title: a.title, artistText: a.artistText, year: a.year, date: a.firstReleaseDate };
}

function Chart({
  rows,
  albums,
  labelWidth,
  markLabel,
  t,
}: {
  rows: Row[];
  /** znaczniki na całej wysokości wykresu (dyskografia zespołu / płyty solowe) */
  albums: Mark[];
  labelWidth: number;
  markLabel: string;
  t: TimelineLabels;
}) {
  const now = new Date().getFullYear() + 1;

  const globalPoints = albums
    .map((a) => ({ album: a, year: toYear(a.date, NaN) }))
    .filter((p) => Number.isFinite(p.year))
    .sort((a, b) => a.year - b.year);
  const rowPoints = rows.map((r) =>
    r.marks
      .map((a) => ({ album: a, year: toYear(a.date, NaN) }))
      .filter((p) => Number.isFinite(p.year))
      .sort((a, b) => a.year - b.year),
  );
  const allYears = [...globalPoints.map((p) => p.year), ...rowPoints.flat().map((p) => p.year)];

  const starts = rows.flatMap((r) => r.spans.map((s) => toYear(s.begin, now)));
  const ends = rows.flatMap((r) => r.spans.map((s) => (s.current ? now : toYear(s.end, now))));
  const from = Math.floor(Math.min(...starts, ...(allYears.length ? [Math.min(...allYears)] : [now])));
  const to = Math.ceil(Math.max(...ends, ...(allYears.length ? [Math.max(...allYears)] : [now])));
  const span = Math.max(1, to - from);

  // Geometria: etykiety po lewej, oś lat na dole.
  const LABEL_W = labelWidth;
  const ROW_H = 22;
  const AXIS_H = 26;
  const W = 900;
  const H = rows.length * ROW_H + AXIS_H + 18;
  const plotW = W - LABEL_W - 12;
  const x = (year: number) => LABEL_W + ((year - from) / span) * plotW;
  const baseY = rows.length * ROW_H + 12;

  // Podziałka co 2, 5 albo 10 lat — tak, żeby podpisów było kilkanaście, nie sto.
  const step = span <= 12 ? 2 : span <= 30 ? 5 : 10;
  const ticks: number[] = [];
  for (let y = Math.ceil(from / step) * step; y <= to; y += step) ticks.push(y);

  const used = new Map<string, string>();
  for (const row of rows) {
    const s = roleStyle(rowRoles(row), t);
    used.set(s.label, s.color);
  }

  const maxName = Math.floor(LABEL_W / 7);

  return (
    <>
      <div className="mt-3 overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} width={W} className="min-w-[680px] max-w-full" role="img" aria-label={t.axisAriaLabel}>
          {/* Pionowe kreski = płyty. Kółko na górze jest klikalne i ma podpowiedź
              (SVG <title> = natywny dymek przeglądarki, bez javascriptu). */}
          {globalPoints.map((p, i) => (
            <a key={`al-${i}`} href={`/album/${p.album.mbid}`} className="album-mark">
              <title>{`${p.album.artistText} – ${p.album.title}${p.album.year ? ` (${p.album.year})` : ""}`}</title>
              <line x1={x(p.year)} x2={x(p.year)} y1={10} y2={baseY} stroke="var(--text)" strokeWidth={1.5} opacity={0.5} />
              <circle cx={x(p.year)} cy={7} r={5} fill="var(--bg)" stroke="var(--text)" strokeWidth={1.5} />
              <circle cx={x(p.year)} cy={7} r={1.7} fill="var(--text)" />
              {/* powiększone pole trafienia — w 5-pikselowe kółko trudno celować */}
              <rect x={x(p.year) - 9} y={0} width={18} height={baseY} fill="transparent" />
            </a>
          ))}
          {rows.map((row, i) => {
            const s = roleStyle(rowRoles(row), t);
            const y = i * ROW_H + 12;
            return (
              <g key={row.mbid}>
                <rect x={LABEL_W} y={y + 4} width={plotW} height={ROW_H - 8} fill="var(--surface2)" />
                {row.spans.map((sp, j) => {
                  // Nieznany okres rozciągamy na całą oś — ale pustym prostokątem
                  // w przerywanej ramce, żeby nikt nie wziął go za fakt.
                  const x1 = sp.unknown ? x(from) : x(toYear(sp.begin, from));
                  const x2 = sp.unknown ? x(to) : x(sp.current ? now : toYear(sp.end, now));
                  const zrodlo = sp.unknown
                    ? ` — ${t.unknownNote}`
                    : sp.inferred
                      ? ` — ${t.inferredNote}`
                      : sp.fromWikidata
                        ? ` — ${t.wikidataNote}`
                        : "";
                  return (
                    <rect
                      key={j}
                      x={x1}
                      y={y + 4}
                      width={Math.max(2, x2 - x1)}
                      height={ROW_H - 8}
                      fill={sp.unknown ? "transparent" : s.color}
                      stroke={sp.unknown ? s.color : undefined}
                      strokeWidth={sp.unknown ? 1.2 : undefined}
                      strokeDasharray={sp.unknown ? "4 3" : undefined}
                      rx={2}
                      opacity={sp.unknown ? 0.7 : sp.inferred ? 0.45 : 1}
                    >
                      <title>
                        {`${row.name}: ${sp.unknown ? "?–?" : `${sp.begin?.slice(0, 4) ?? "?"}–${sp.current ? t.today : sp.end?.slice(0, 4) ?? "?"}`}${sp.roles.length ? ` (${sp.roles.join(", ")})` : ""}${zrodlo}`}
                      </title>
                    </rect>
                  );
                })}
                {/* Płyty tego wiersza — romby na pasku (widok muzyka).
                    Wypełniony = wyszła, gdy był w składzie; pusty i przygaszony
                    = dorobek zespołu spoza jego kadencji. */}
                {rowPoints[i].map((p, j) => {
                  const inSpan = row.spans.some(
                    (sp) => p.year >= toYear(sp.begin, -Infinity) && p.year <= (sp.current ? now : toYear(sp.end, now)),
                  );
                  return (
                    <a key={`rm-${j}`} href={`/album/${p.album.mbid}`} className="album-mark">
                      <title>
                        {`${p.album.artistText} – ${p.album.title}${p.album.year ? ` (${p.album.year})` : ""}${inSpan ? "" : t.outOfSpanSuffix}`}
                      </title>
                      <rect
                        x={x(p.year) - 4}
                        y={y + ROW_H / 2 - 4}
                        width={8}
                        height={8}
                        transform={`rotate(45 ${x(p.year)} ${y + ROW_H / 2})`}
                        fill={inSpan ? "var(--text)" : "var(--bg)"}
                        stroke="var(--text)"
                        strokeWidth={1.4}
                        opacity={inSpan ? 1 : 0.45}
                      />
                      <rect x={x(p.year) - 7} y={y} width={14} height={ROW_H} fill="transparent" />
                    </a>
                  );
                })}
                <a href={`/artist/${row.mbid}`}>
                  <title>{row.name}</title>
                  <text x={LABEL_W - 8} y={y + ROW_H / 2 + 4} textAnchor="end" fontSize="12" fill="var(--text2)" fontFamily="var(--font-sans)">
                    {(row.name.length > maxName ? row.name.slice(0, maxName - 1) + "…" : row.name) +
                      (row.spans.every((sp) => sp.unknown) ? " ?" : "")}
                  </text>
                </a>
              </g>
            );
          })}
          {/* oś lat */}
          <line x1={LABEL_W} x2={W - 12} y1={baseY} y2={baseY} stroke="var(--rule)" />
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={x(tick)} x2={x(tick)} y1={baseY} y2={baseY + 4} stroke="var(--rule)" />
              <text x={x(tick)} y={baseY + 17} textAnchor="middle" fontSize="11" fill="var(--muted)" fontFamily="var(--font-mono)">
                {tick}
              </text>
            </g>
          ))}
        </svg>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-muted">
          {[...used.entries()].map(([label, color]) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: color }} />
              {label}
            </span>
          ))}
          {globalPoints.length > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-0.5 bg-text" />
              {markLabel}
            </span>
          )}
          {rowPoints.some((p) => p.length > 0) && (
            <>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rotate-45 bg-text" />
                {t.legendInSpan}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rotate-45 border border-text opacity-45" />
                {t.legendOutSpan}
              </span>
            </>
          )}
        </div>
        {rows.some((r) => r.spans.some((sp) => sp.unknown)) && (
          <div className="mt-1 flex items-center gap-1.5 font-mono text-[10px] text-muted">
            <span className="inline-block h-2.5 w-4 rounded-sm border border-dashed border-muted" />
            {t.legendUnknown}
          </div>
        )}
        {rows.some((r) => r.spans.some((sp) => sp.fromWikidata)) && (
          <div className="mt-1 flex items-center gap-1.5 font-mono text-[10px] text-muted">
            <span className="inline-block h-2.5 w-4 rounded-sm bg-muted" />
            {t.legendWikidata}
          </div>
        )}
        {rows.some((r) => r.spans.some((sp) => sp.inferred)) && (
          <div className="mt-1 flex items-center gap-1.5 font-mono text-[10px] text-muted">
            <span className="inline-block h-2.5 w-4 rounded-sm bg-muted opacity-45" />
            {t.legendInferred}
          </div>
        )}
        <p className="mt-1 text-[10px] text-faint">{t.footnote}</p>
      </div>
    </>
  );
}

/** Widok zespołu: po lewej ludzie, pionowe kreski to dyskografia zespołu. */
export function LineupTimeline({ members, albums, locale, t }: { members: Membership[]; albums: AlbumSummary[]; locale: Locale; t: TimelineLabels }) {
  // Bez odsiewania po datach: człowiek bez dat członkostwa to nadal część składu.
  const rows = fillMissingSpans(mergeSpans<Membership, Mark>(members));
  if (!rows.length) return null;
  return (
    <details className="mt-6">
      <summary className="cursor-pointer text-muted hover:text-accent2">{plural(locale, rows.length, t.lineupSummary)}</summary>
      <Chart rows={rows} albums={albums.map(markOf)} labelWidth={150} markLabel={t.markAlbumLabel} t={t} />
    </details>
  );
}

/**
 * Widok muzyka: po lewej zespoły, romby na paskach to płyty nagrane z danym
 * zespołem, pionowe kreski — własna dyskografia (jeśli jakąś ma).
 *
 * `albumsByBand` przychodzi z „Grał(a) na płytach", więc rysujemy dokładnie to
 * samo, co strona i tak pokazuje niżej listą — tylko w czasie.
 */
export function CareerTimeline({
  name,
  mbid,
  bands,
  albumsByBand,
  own,
  locale,
  t,
}: {
  name: string;
  /** MBID oglądanego artysty — jego własny „zespół" dostaje wiersz jak każdy inny */
  mbid: string;
  bands: Membership[];
  albumsByBand: Map<string, AlbumSummary[]>;
  own: AlbumSummary[];
  locale: Locale;
  t: TimelineLabels;
}) {
  // Bierzemy WSZYSTKIE zespoły, nie tylko te z datami: przy Inferno z Behemotha
  // MusicBrainz ma gołą relację bez dat i cała oś znikała. Czego nie da się
  // umiejscowić nawet po płytach, odpada w fillMissingSpans.
  const rows = fillMissingSpans(
    mergeSpans<Membership, Mark>(bands, (m) => (albumsByBand.get(m.mbid) ?? []).map(markOf)),
  );

  /**
   * Własny szyld na pierwszym miejscu.
   *
   * Ozzy Osbourne grał w Black Sabbath — i był Ozzym Osbournem: kilkanaście płyt
   * pod własnym nazwiskiem, z własnymi składami. MusicBrainz nie ma na to relacji
   * „member of band" (bo i po co: to ta sama encja), więc na osi nie było go
   * wcale, choć jego płyty leciały tam pionowymi kreskami bez przypisania.
   * Robimy mu wiersz z jego dyskografii — daty z płyt, stąd przerywany styl.
   */
  const wlasneZnaczniki = own.map(markOf);
  const lata = wlasneZnaczniki.map((m) => m.date).filter((d): d is string => !!d).sort();
  const wlasnyWiersz: Row | null = lata.length
    ? {
        mbid,
        name,
        marks: wlasneZnaczniki,
        spans: [{ begin: lata[0], end: lata[lata.length - 1], current: false, roles: [], inferred: true }],
      }
    : null;

  const wszystkie = wlasnyWiersz ? [wlasnyWiersz, ...rows] : rows;
  if (!wszystkie.length) return null;
  return (
    <details className="mt-6" open>
      <summary className="cursor-pointer text-muted hover:text-accent2">
        {fmt(plural(locale, wszystkie.length, t.careerSummary), { name })}
      </summary>
      {/* Gdy własny szyld ma swój wiersz, pionowe kreski przez cały wykres byłyby
          tymi samymi płytami drugi raz — więc ich nie rysujemy. */}
      <Chart
        rows={wszystkie}
        albums={wlasnyWiersz ? [] : wlasneZnaczniki}
        labelWidth={180}
        markLabel={t.markOwnLabel}
        t={t}
      />
    </details>
  );
}
