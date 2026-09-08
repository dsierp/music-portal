/**
 * Kto widzi statystyki portalu.
 *
 * Lista adresów, nie flaga w bazie — bo dziś to jedna osoba i dokładanie tabeli
 * ról byłoby budowaniem administracji, której nikt jeszcze nie potrzebuje.
 * `PORTAL_ADMINS` w env pozwala dopisać kolejnych bez ruszania kodu.
 */
const BUILT_IN = ["rogaty@rogaty.pl"];

export function adminEmails(): string[] {
  const extra = (process.env.PORTAL_ADMINS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set([...BUILT_IN, ...extra])];
}

export function isAdmin(email: string | null | undefined): boolean {
  const e = (email ?? "").trim().toLowerCase();
  return !!e && adminEmails().includes(e);
}
