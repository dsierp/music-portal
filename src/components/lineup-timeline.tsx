import type { AlbumSummary, Membership } from "@/lib/musicbrainz";

/**
 * Oś czasu składu — kto grał w zespole i kiedy, na tle dat wydania płyt.
 *
 * Rysowana z danych, które strona zespołu i tak już ma: członkostwa z MusicBrainz
 * (mają daty od–do i instrumenty) plus dyskografia. Zero dodatkowych zapytań,
 * więc nic nie spowalnia.
 *
 * Czyta się z niej to, czego nie widać z listy nazwisk: ile trwały składy, które
 * płyty nagrał który skład i gdzie zespół się rozsypywał. Pionowe kreski to
 * albumy studyjne — widać na nich, czy zmiana perkusisty wypadła w środku cyklu.
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

export function LineupTimeline({ members, albums }: { members: Membership[]; albums: AlbumSummary[] }) {
  const now = new Date().getFullYear() + 1;
  const people = members.filter((m) => m.begin || m.end);
  if (people.length < 2) return null; // przy jednym pasku wykres niczego nie pokazuje

  const albumYears = albums
    .map((a) => toYear(a.firstReleaseDate, NaN))
    .filter((y) => Number.isFinite(y))
    .sort((a, b) => a - b);

  const starts = people.map((m) => toYear(m.begin, now));
  const ends = people.map((m) => (m.current ? now : toYear(m.end, now)));
  const from = Math.floor(Math.min(...starts, ...(albumYears.length ? [albumYears[0]] : [now])));
  const to = Math.ceil(Math.max(...ends, ...(albumYears.length ? [albumYears[albumYears.length - 1]] : [now])));
  const span = Math.max(1, to - from);

  // Geometria: etykiety po lewej, oś lat na dole.
  const LABEL_W = 150;
  const ROW_H = 22;
  const AXIS_H = 26;
  const W = 900;
  const H = people.length * ROW_H + AXIS_H + 6;
  const plotW = W - LABEL_W - 12;
  const x = (year: number) => LABEL_W + ((year - from) / span) * plotW;

  // Podziałka co 2, 4 albo 5 lat — tak, żeby podpisów było kilkanaście, nie sto.
  const step = span <= 12 ? 2 : span <= 30 ? 5 : 10;
  const ticks: number[] = [];
  for (let y = Math.ceil(from / step) * step; y <= to; y += step) ticks.push(y);

  const used = new Map<string, string>();
  for (const m of people) {
    const s = roleStyle(m.roles);
    used.set(s.label, s.color);
  }

  return (
    <details className="mt-6">
      <summary className="cursor-pointer text-muted hover:text-accent2">Oś czasu składu ({people.length} osób)</summary>
      <div className="mt-3 overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} width={W} className="min-w-[680px] max-w-full" role="img" aria-label="Oś czasu składu zespołu">
          {/* pionowe kreski = albumy studyjne */}
          {albumYears.map((y, i) => (
            <line key={`al-${i}`} x1={x(y)} x2={x(y)} y1={0} y2={people.length * ROW_H} stroke="var(--text)" strokeWidth={1.5} opacity={0.55} />
          ))}
          {people.map((m, i) => {
            const s = roleStyle(m.roles);
            const y = i * ROW_H;
            const x1 = x(toYear(m.begin, from));
            const x2 = x(m.current ? now : toYear(m.end, now));
            return (
              <g key={m.mbid + i}>
                <rect x={LABEL_W} y={y + 4} width={plotW} height={ROW_H - 8} fill="var(--surface2)" />
                <rect x={x1} y={y + 4} width={Math.max(2, x2 - x1)} height={ROW_H - 8} fill={s.color} rx={2} />
                <text x={LABEL_W - 8} y={y + ROW_H / 2 + 4} textAnchor="end" fontSize="12" fill="var(--text2)" fontFamily="var(--font-sans)">
                  {m.name.length > 22 ? m.name.slice(0, 21) + "…" : m.name}
                </text>
              </g>
            );
          })}
          {/* oś lat */}
          <line x1={LABEL_W} x2={W - 12} y1={people.length * ROW_H} y2={people.length * ROW_H} stroke="var(--rule)" />
          {ticks.map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={people.length * ROW_H} y2={people.length * ROW_H + 4} stroke="var(--rule)" />
              <text x={x(t)} y={people.length * ROW_H + 17} textAnchor="middle" fontSize="11" fill="var(--muted)" fontFamily="var(--font-mono)">
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
          {albumYears.length > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-0.5 bg-text" />
              album
            </span>
          )}
        </div>
        <p className="mt-1 text-[10px] text-faint">
          Z dat członkostwa w MusicBrainz. Brakujące daty rysujemy do dziś — MB nie zawsze ma komplet.
        </p>
      </div>
    </details>
  );
}
