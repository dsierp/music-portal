/**
 * Co naprawdę jest w bazie na Neonie: npx tsx scripts/check-neon.ts
 *
 * Po co osobny skrypt: produkcja chowa treść błędu („An error occurred in the
 * Server Components render"), a najczęstszą przyczyną takiego ekranu jest brak
 * migracji — kod pyta o kolumnę albo tabelę, której w chmurze jeszcze nie ma.
 * Zamiast zgadywać, pytamy bazę wprost i porównujemy z tym, czego kod wymaga.
 *
 * Skrypt niczego nie zmienia. Czyta wyłącznie katalog systemowy Postgresa.
 */
import "dotenv/config";
import { Client } from "pg";

/** Czego kod wymaga na dziś — zmieniasz schemat, dopisujesz tutaj. */
const WYMAGANE_TABELE = [
  "user",
  "account",
  "session",
  "user_genre",
  "liked_album",
  "favorite_artist",
  "user_area",
  "rating",
  "comment",
  "list",
  "list_item",
  "list_share",
  "list_visit",
  "release_section",
  "release",
  "best_of_year",
  "best_of_entry",
  "api_cache",
];
const WYMAGANE_KOLUMNY: Record<string, string[]> = {
  user: ["locale"],
  liked_album: ["kind"],
  favorite_artist: ["kind"],
  list_item: ["url"],
};

async function main() {
  const url = (process.env.NEON_DATABASE_URL ?? "").trim();
  if (!url) {
    console.error("Brak NEON_DATABASE_URL w .env — nie mam czego sprawdzać.");
    process.exit(1);
  }
  const c = new Client({ connectionString: url });
  await c.connect();

  const tabele = new Set(
    (await c.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public'",
    )).rows.map((r) => r.table_name),
  );
  const brakTabel = WYMAGANE_TABELE.filter((t) => !tabele.has(t));

  const brakKolumn: string[] = [];
  for (const [tabela, kolumny] of Object.entries(WYMAGANE_KOLUMNY)) {
    if (!tabele.has(tabela)) continue;
    const maja = new Set(
      (await c.query<{ column_name: string }>(
        "select column_name from information_schema.columns where table_schema = 'public' and table_name = $1",
        [tabela],
      )).rows.map((r) => r.column_name),
    );
    for (const k of kolumny) if (!maja.has(k)) brakKolumn.push(`${tabela}.${k}`);
  }

  const migracje = tabele.has("__drizzle_migrations")
    ? (await c.query<{ n: string }>("select count(*)::text as n from public.__drizzle_migrations")).rows[0]?.n
    : (await c
        .query<{ n: string }>("select count(*)::text as n from drizzle.__drizzle_migrations")
        .catch(() => ({ rows: [{ n: "?" }] }))).rows[0]?.n;

  console.log(`\nTabele w bazie: ${tabele.size}`);
  console.log(`Zastosowanych migracji: ${migracje ?? "?"}`);

  if (!brakTabel.length && !brakKolumn.length) {
    console.log("\n✓ Schemat zgadza się z kodem. Błąd na stronie ma inną przyczynę — zajrzyj w Vercel → Logs.");
  } else {
    if (brakTabel.length) console.log(`\n✗ BRAKUJE TABEL: ${brakTabel.join(", ")}`);
    if (brakKolumn.length) console.log(`✗ BRAKUJE KOLUMN: ${brakKolumn.join(", ")}`);
    console.log("\nTo dokładnie ten objaw: kod pyta o coś, czego w bazie nie ma.");
    console.log("Naprawa: npm run neon:setup -- --tylko-migracje");
  }

  await c.end();
}

main().catch((e) => {
  console.error("Nie udało się połączyć z bazą:", e instanceof Error ? e.message : e);
  process.exit(1);
});
