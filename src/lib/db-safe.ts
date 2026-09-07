/**
 * Miękkie podejście do błędów lokalnej bazy.
 *
 * Lokalna baza (PGlite w pliku) potrafi paść — najczęściej gdy proces zostanie
 * ubity w trakcie zapisu albo gdy dwa procesy piszą do jednego katalogu.
 * Wtedy KAŻDE zapytanie rzuca wyjątkiem, a że strony są server-side, cała
 * strona zamienia się w czerwony ekran błędu — nawet ta część, która wcale
 * bazy nie potrzebuje (opis płyty, skład, utwory — to wszystko z MusicBrainz).
 *
 * dbSafe() zamienia taki wyjątek na wartość zastępczą i informację, że coś
 * padło — strona zostaje czytelna, a użytkownik dostaje konkretną instrukcję
 * zamiast stack trace'u.
 */
export interface Safe<T> {
  value: T;
  failed: boolean;
}

export async function dbSafe<T>(p: Promise<T>, fallback: T): Promise<Safe<T>> {
  try {
    return { value: await p, failed: false };
  } catch (e) {
    console.error("[baza] zapytanie nie powiodło się:", e instanceof Error ? e.message : e);
    return { value: fallback, failed: true };
  }
}
