/**
 * Tłumaczenia po stronie serwera.
 *
 *   const { t, locale } = await i18n();
 *   <h2>{t.concerts.title}</h2>
 *
 * Tu — i tylko tu — sięgamy po ciasteczko i nagłówki żądania. `src/lib/i18n.ts`
 * został czysty (same stałe i formatowanie), bo importują go też komponenty
 * klienckie, a te nie mogą tknąć „next/headers": build wywala się wtedy na
 * całym pakiecie, nie na jednej stronie.
 *
 * Komponenty klienckie napisów nie wołają — dostają je propsami od rodzica.
 */
import { cookies, headers } from "next/headers";
import { dict, type Dict } from "@/lib/dict";
import { DEFAULT_LOCALE, LOCALE_COOKIE, fromAcceptLanguage, normalizeLocale, type Locale } from "@/lib/i18n";

/**
 * Język bieżącego żądania: ciasteczko → profil → przeglądarka → polski.
 * `profile` podaje wywołujący, jeśli akurat zna ustawienie zalogowanego —
 * żeby nie pytać bazy drugi raz.
 */
export async function resolveLocale(profile?: string | null): Promise<Locale> {
  const fromCookie = normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  if (fromCookie) return fromCookie;
  const fromProfile = normalizeLocale(profile);
  if (fromProfile) return fromProfile;
  return fromAcceptLanguage((await headers()).get("accept-language")) ?? DEFAULT_LOCALE;
}

export async function i18n(profileLocale?: string | null): Promise<{ locale: Locale; t: Dict }> {
  const locale = await resolveLocale(profileLocale);
  return { locale, t: dict(locale) };
}
