/**
 * Czytelny opis błędu bazy dla skryptów.
 *
 * Drizzle opakowuje błędy Postgresa w DrizzleQueryError i wypisuje całe
 * zapytanie z parametrami, ale PRAWDZIWĄ przyczynę chowa w `cause`. Efekt:
 * pół ekranu SQL-a, z którego nie wynika, czy brakuje tabeli, czy zerwało
 * połączenie. Ta funkcja wyciąga to, co się liczy, i tłumaczy najczęstsze
 * przypadki na ludzki język.
 */
export function describeDbError(e: unknown): string {
  const err = e as { message?: string; cause?: { message?: string; code?: string; detail?: string; hostname?: string } };
  const cause = err?.cause;
  const code = cause?.code;
  const msg = cause?.message ?? err?.message ?? String(e);

  // Adres jeszcze z zaślepki: w DATABASE_URL siedzi „…nowy…" albo <coś> zamiast
  // prawdziwego hosta z panelu Neona. Bez tego dalsze podpowiedzi mylą trop.
  const host = cause?.hostname;
  if (host && /[…<>]|nowy|twoj|xxx|host/i.test(host)) {
    return `Adres bazy to wciąż zaślepka: host „${host}" [${code ?? "?"}]
W pliku .env (albo .env.local) wpisz PRAWDZIWY adres skopiowany z panelu Neona —
cały, jednym ciągiem, od „postgresql://" do „?sslmode=require".`;
  }

  const hint =
    code === "42P01"
      ? "Tabela nie istnieje — najpierw `npm run db:migrate` na TEJ SAMEJ bazie (ten sam DATABASE_URL)."
      : code === "42703"
        ? "Brak kolumny — baza ma starszy schemat niż kod. Uruchom `npm run db:migrate`."
        : code === "28P01"
          ? "Błędne hasło do bazy (być może zostało zrotowane) — weź świeży adres z panelu Neona."
          : code === "3D000"
            ? "Taka baza nie istnieje — sprawdź nazwę na końcu adresu połączenia."
            : code === "23503"
              ? "Klucz obcy: rekord wskazuje na coś, czego nie ma (np. użytkownik skasowany)."
              : code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "EAI_AGAIN" || code === "EINVAL"
                ? "Nie udało się połączyć z bazą — sprawdź adres i czy masz dostęp do sieci."
                : "";

  return [`${msg}${code ? ` [${code}]` : ""}`, cause?.detail, hint].filter(Boolean).join("\n");
}
