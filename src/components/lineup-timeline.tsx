import type { AlbumSummary, Membership } from "@/lib/musicbrainz";
import { mergeSpans, rowRoles, type TimelineRow } from "@/lib/timeline";

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
 */
const ROLE_COLORS: { match: RegExp; color: string; label: string }[] = [
  { match: /vocal|voice|śpiew/i, color: "#d6392f", label: "wokal" },
  { match: /guitar|gitar/i, color: "#5aa84f", label: "gitara" },
  { match: /bass|bas\b/i, color: "#5b8fd6", label: "bas" },
  { match: /drum|perkus|percussion/i, color: "#e0913f", label: "perkusja" },
  { match: /key|piano|organ|synth/i, color: "#a071c9", label: "klawisze" },
];
const OTHER = { color: "#7c8296", label: "inne" };

function roleStyle(roles: string[]) {
  for (const r of roles) {
    const hit = ROLE_COLORS.find((c) => c.match.test(r));
    if (hit) return hit;
  }
  return OTHER;
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
}: {
  rows: Row[];
  /** znaczniki na całej wysokości wykresu (dyskografia zespołu / płyty solowe) */
  albums: Mark[];
  labelWidth: number;
  markLabel: string;
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
    const s = roleStyle(rowRoles(row));
    used.set(s.label, s.color);
  }

  const maxName = Math.floor(LABEL_W / 7);

  return (
    <>
      <div className="mt-3 overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} width={W} className="min-w-[680px] max-w-full" role="img" aria-label="Oś czasu">
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
            const s = roleStyle(rowRoles(row));
            const y = i * ROW_H + 12;
            return (
              <g key={row.mbid}>
                <rect x={LABEL_W} y={y + 4} width={plotW} height={ROW_H - 8} fill="var(--surface2)" />
                {row.spans.map((sp, j) => {
                  const x1 = x(toYear(sp.begin, from));
                  const x2 = x(sp.current ? now : toYear(sp.end, now));
                  return (
                    <rect key={j} x={x1} y={y + 4} width={Math.max(2, x2 - x1)} height={ROW_H - 8} fill={s.color} rx={2}>
                      <title>
                        {`${row.name}: ${sp.begin?.slice(0, 4) ?? "?"}–${sp.current ? "dziś" : sp.end?.slice(0, 4) ?? "?"}${sp.roles.length ? ` (${sp.roles.join(", ")})` : ""}`}
                      </title>
                    </rect>
                  );
                })}
                {/* płyty tego wiersza — romby na pasku (widok muzyka) */}
                {rowPoints[i].map((p, j) => (
                  <a key={`rm-${j}`} href={`/album/${p.album.mbid}`} className="album-mark">
                    <title>{`${p.album.artistText} – ${p.album.title}${p.album.year ? ` (${p.album.year})` : ""}`}</title>
                    <rect
                      x={x(p.year) - 3.5}
                      y={y + ROW_H / 2 - 3.5}
                      width={7}
                      height={7}
                      transform={`rotate(45 ${x(p.year)} ${y + ROW_H / 2})`}
                      fill="var(--bg)"
                      stroke="var(--text)"
                      strokeWidth={1.4}
                    />
                    <rect x={x(p.year) - 7} y={y} width={14} height={ROW_H} fill="transparent" />
                  </a>
                ))}
                <a href={`/artist/${row.mbid}`}>
                  <title>{row.name}</title>
                  <text x={LABEL_W - 8} y={y + ROW_H / 2 + 4} textAnchor="end" fontSize="12" fill="var(--text2)" fontFamily="var(--font-sans)">
                    {row.name.length > maxName ? row.name.slice(0, maxName - 1) + "…" : row.name}
                  </text>
                </a>
              </g>
            );
          })}
          {/* oś lat */}
          <line x1={LABEL_W} x2={W - 12} y1={baseY} y2={baseY} stroke="var(--rule)" />
          {ticks.map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={baseY} y2={baseY + 4} stroke="var(--rule)" />
              <text x={x(t)} y={baseY + 17} textAnchor="middle" fontSize="11" fill="var(--muted)" fontFamily="var(--font-mono)">
                {t}
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
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rotate-45 border border-text" />
              płyta nagrana w tym składzie — kliknij po stronę płyty
            </span>
          )}
        </div>
        <p className="mt-1 text-[10px] text-faint">
          Z dat członkostwa w MusicBrainz. Brakujące daty rysujemy do dziś — MB nie zawsze ma komplet.
          Przerwa w pasku to odejście i powrót.
        </p>
      </div>
    </>
  );
}

/** Widok zespołu: po lewej ludzie, pionowe kreski to dyskografia zespołu. */
export function LineupTimeline({ members, albums }: { members: Membership[]; albums: AlbumSummary[] }) {
  const rows = mergeSpans<Membership, Mark>(members.filter((m) => m.begin || m.end));
  if (rows.length < 2) return null; // przy jednym pasku wykres niczego nie pokazuje
  return (
    <details className="mt-6">
      <summary className="cursor-pointer text-muted hover:text-accent2">Oś czasu składu ({rows.length} osób)</summary>
      <Chart rows={rows} albums={albums.map(markOf)} labelWidth={150} markLabel="album — najedź po tytuł, kliknij po stronę płyty" />
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
  bands,
  albumsByBand,
  own,
}: {
  name: string;
  bands: Membership[];
  albumsByBand: Map<string, AlbumSummary[]>;
  own: AlbumSummary[];
}) {
  const rows = mergeSpans<Membership, Mark>(
    bands.filter((b) => b.begin || b.end),
    (m) => (albumsByBand.get(m.name) ?? []).map(markOf),
  );
  if (rows.length < 2) return null;
  return (
    <details className="mt-6" open>
      <summary className="cursor-pointer text-muted hover:text-accent2">
        Oś czasu: gdzie grał(a) {name} ({rows.length} zespołów)
      </summary>
      <Chart rows={rows} albums={own.map(markOf)} labelWidth={180} markLabel="płyta pod własnym nazwiskiem" />
    </details>
  );
}
