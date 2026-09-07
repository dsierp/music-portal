/**
 * Oceny z zewnętrznych serwisów (RateYourMusic, Album of the Year, Sputnikmusic,
 * ProgArchives) — wyciągane z danych strukturalnych JSON-LD (schema.org
 * AggregateRating), które te strony zwykle osadzają w <head>. To najbardziej
 * odporny na zmiany layoutu sposób — nie zgadujemy klas CSS.
 *
 * Próbujemy WYŁĄCZNIE dla linków, które MusicBrainz potwierdził jako dokładne
 * (Links.exact) — link z wyszukiwarki mógłby wskazywać na złą płytę/artystę.
 *
 * Serwisy różnią się dostępnością z róznych sieci i bywają niestabilne —
 * każdy błąd (403, timeout, brak danych) po prostu daje `null` dla danego
 * źródła, strona wtedy pokazuje sam link bez oceny (bez błędu dla usera).
 */
import { cached, TTL } from "./cache";
import type { Links } from "./musicbrainz";

const UA =
  process.env.EXTERNAL_RATINGS_USER_AGENT ??
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 6000;

export interface ExternalRating {
  source: string;
  /** np. "4.18 / 5" albo "79 / 100" — gotowe do wyświetlenia, bez przeliczania skal. */
  display: string;
  count: number | null;
  url: string;
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

interface AggregateRatingRaw {
  ratingValue?: string | number;
  bestRating?: string | number;
  ratingCount?: string | number;
  reviewCount?: string | number;
}

function findAggregateRating(node: unknown): AggregateRatingRaw | null {
  if (!node || typeof node !== "object") return null;
  const obj = node as Record<string, unknown>;
  if (obj.aggregateRating && typeof obj.aggregateRating === "object") return obj.aggregateRating as AggregateRatingRaw;
  if (Array.isArray(obj["@graph"])) {
    for (const g of obj["@graph"]) {
      const found = findAggregateRating(g);
      if (found) return found;
    }
  }
  return null;
}

function extractAggregateRating(html: string): { value: number; best: number; count: number | null } | null {
  const blocks = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const m of blocks) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(m[1].trim());
    } catch {
      continue;
    }
    const candidates = Array.isArray(parsed) ? parsed : [parsed];
    for (const c of candidates) {
      const ar = findAggregateRating(c);
      if (!ar?.ratingValue) continue;
      const value = Number(ar.ratingValue);
      if (!Number.isFinite(value)) continue;
      const best = Number(ar.bestRating ?? 5);
      const countRaw = ar.ratingCount ?? ar.reviewCount;
      const count = countRaw !== undefined ? Number(countRaw) : null;
      return { value, best: Number.isFinite(best) ? best : 5, count: count !== null && Number.isFinite(count) ? count : null };
    }
  }
  return null;
}

function fmtValue(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

async function fetchOne(source: string, url: string): Promise<ExternalRating | null> {
  // Wynik pakujemy w obiekt {r: …}, bo kolumna cache'u jest NOT NULL — samo `null`
  // nie zapisałoby się i każde wejście na stronę męczyłoby serwis od nowa.
  // Brak oceny też chcemy zapamiętać (na krócej — może dojść).
  const hit = await cached<{ r: ExternalRating | null }>(`extrating:v1:${url}`, TTL.wiki, async () => {
    const html = await fetchHtml(url);
    const ar = html ? extractAggregateRating(html) : null;
    if (!ar) return { r: null };
    return {
      r: { source, display: `${fmtValue(ar.value)} / ${fmtValue(ar.best)}`, count: ar.count, url },
    };
  });
  return hit?.r ?? null;
}

const SOURCES: { key: keyof Links; label: string }[] = [
  { key: "albumOfTheYear", label: "Album of the Year" },
  { key: "progArchives", label: "ProgArchives" },
  { key: "rateYourMusic", label: "RateYourMusic" },
  { key: "sputnikmusic", label: "Sputnikmusic" },
];

/**
 * Zwraca oceny dla linków, które MB potwierdził jako dokładne (links.exact).
 * Best-effort: brak wyniku dla danego serwisu (blokada, brak danych, timeout)
 * po prostu pomija go — bez rzucania błędu.
 */
export async function getExternalRatings(links: Links): Promise<ExternalRating[]> {
  const exact = new Set(links.exact ?? []);
  const wanted = SOURCES.filter((s) => exact.has(s.key) && links[s.key]);
  if (!wanted.length) return [];
  const results = await Promise.all(
    wanted.map((s) => fetchOne(s.label, links[s.key] as string).catch(() => null)),
  );
  return results.filter((r): r is ExternalRating => !!r);
}
