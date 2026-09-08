/**
 * Języki portalu.
 *
 * Wybór trzymamy w ciasteczku (działa dla niezalogowanych i od razu, bez
 * zapytania do bazy), a zalogowanym dodatkowo w profilu — dzięki temu język
 * idzie za człowiekiem na inne urządzenie. Adresy zostają bez prefiksu:
 * /artist/… jest jedno, niezależnie od języka.
 *
 * Kolejność decydowania: ciasteczko → profil → nagłówek przeglądarki → polski.
 */
export const LOCALES = ["pl", "en", "es", "de"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "pl";
export const LOCALE_COOKIE = "pns_lang";
/** Rok — wybór języka to nie sesja. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Nazwa języka w nim samym — tak się podpisuje przełączniki. */
export const LOCALE_NAMES: Record<Locale, string> = {
  pl: "Polski",
  en: "English",
  es: "Español",
  de: "Deutsch",
};

/** Kod BCP-47 do Intl i atrybutu lang. */
export const LOCALE_TAGS: Record<Locale, string> = {
  pl: "pl-PL",
  en: "en-GB",
  es: "es-ES",
  de: "de-DE",
};

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

/** „de-AT", „DE", „ de " → „de"; cokolwiek innego → null. */
export function normalizeLocale(v: string | null | undefined): Locale | null {
  const base = (v ?? "").trim().toLowerCase().split(/[-_]/)[0];
  return isLocale(base) ? base : null;
}

/**
 * Pierwszy obsługiwany język z nagłówka Accept-Language, z uwzględnieniem wag
 * („pl;q=0.9"). Nie udajemy pełnej negocjacji — wystarczy kolejność jakości.
 */
export function fromAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;
  const parts = header
    .split(",")
    .map((chunk) => {
      const [tag, ...params] = chunk.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { tag, q: q ? Number(q.slice(2)) || 0 : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const p of parts) {
    const l = normalizeLocale(p.tag);
    if (l) return l;
  }
  return null;
}

/**
 * Języki Wikipedii do próbowania po kolei: najpierw wybrany, potem angielski
 * (największy), na końcu polski — bo przy polskich zespołach bywa jedynym.
 */
export function wikiLangs(locale: Locale): string[] {
  return [...new Set([locale, "en", "pl"])];
}

/** „2026-10-04" → „4 października" / „4 October" / „4 de octubre" / „4. Oktober". */
export function formatDate(iso: string, locale: Locale, opts?: { year?: boolean }): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const showYear = opts?.year ?? new Date().getUTCFullYear() !== y;
  return new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
    day: "numeric",
    month: "long",
    ...(showYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function formatNumber(n: number, locale: Locale): string {
  return new Intl.NumberFormat(LOCALE_TAGS[locale]).format(n);
}

/**
 * Liczba mnoga. Polski ma trzy formy („1 płyta, 2 płyty, 5 płyt"), reszta
 * naszych języków dwie — bierzemy je z Intl.PluralRules, żeby nie zgadywać.
 */
export function plural(locale: Locale, n: number, forms: { one: string; few?: string; many: string }): string {
  const rule = new Intl.PluralRules(LOCALE_TAGS[locale]).select(n);
  const form = rule === "one" ? forms.one : rule === "few" ? forms.few ?? forms.many : forms.many;
  return form.replace("{n}", formatNumber(n, locale));
}

/** Podstawianie w napisach: fmt("Znalazłam {n}", { n: 3 }). */
export function fmt(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key) => (key in params ? String(params[key]) : whole));
}
