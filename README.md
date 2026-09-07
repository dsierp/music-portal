# Pure New Shit — portal

Portal do słuchania i „podróżowania” po muzyce (metal, prog, jazz):

- **logowanie** kontem Google / Microsoft / Apple / Facebook (Auth.js) — znamy e-mail,
- **preferencje**: style muzyczne z wagą 1–5, płyty „lubię”, ulubieni artyści,
- **premiery piątkowe** i **best of** — import z zestawienia *Pure New Shit* (ten sam plik HTML, który generuje piątkowe zadanie),
- **podróż**: płyta → skład (muzycy) → muzyk → jego zespoły i płyty, na których grał → kolejna płyta…,
- **oceny** (1–10, zbiorczo: średnia + rozkład) i **komentarze** (wątki z odpowiedziami) dla płyt i artystów,
- **listy** społeczności: najwyżej oceniane, najczęściej lubiane, najbardziej komentowane.

Każda płyta ma link do **Spotify** i **Tidal** (bezpośredni, jeśli MusicBrainz go zna; inaczej wyszukiwanie).

## Skąd dane

Nie budujemy własnej bazy wiedzy. Katalog jest w zewnętrznych bazach, kluczem jest **MBID** (MusicBrainz ID):

| Co | Źródło |
|---|---|
| płyty, artyści, składy (kto grał na jakim nagraniu), członkowie zespołów, linki | [MusicBrainz API](https://musicbrainz.org/doc/MusicBrainz_API) (`src/lib/musicbrainz.ts`) |
| opisy | Wikipedia (pl, potem en) — tytuł artykułu z relacji MB *wikipedia* / *wikidata* (`src/lib/wikipedia.ts`) |
| okładki | Cover Art Archive (po MBID release-group) |
| premiery, best of | plik `purenewshit.html` (`scripts/import-pns.ts`) |
| użytkownicy, preferencje, oceny, komentarze | nasz Postgres (`src/db/schema.ts`) |

Odpowiedzi API są buforowane w tabeli `api_cache` (wyszukiwanie 1 dzień, lookup 7 dni, Wikipedia 14 dni). MusicBrainz wymaga ≤1 zapytania/s i własnego `User-Agent` — klient to egzekwuje.

## Stack

Next.js 15 (App Router, server actions, TypeScript) · Tailwind 4 · Drizzle ORM + PostgreSQL · Auth.js v5.

## Uruchomienie lokalne

```bash
cp .env.example .env         # uzupełnij AUTH_SECRET (npx auth secret) i ewentualnie klucze OAuth
docker compose up -d         # Postgres na localhost:5432
npm install
npm run db:migrate           # tworzy tabele
npm run import:pns -- data/purenewshit.html   # premiery + best of
npm run dev                  # http://localhost:3000
```

Bez kluczy OAuth działa **logowanie deweloperskie** (`AUTH_DEV_LOGIN=true`, tylko poza produkcją): na `/login` wpisujesz sam e-mail.

### Dostawcy logowania

W `.env` ustaw pary `AUTH_<PROVIDER>_ID` / `AUTH_<PROVIDER>_SECRET`; nieustawieni dostawcy nie pokazują się na `/login`.
Redirect URI w konsoli dostawcy: `https://twoja-domena/api/auth/callback/<provider>`, gdzie provider ∈ `google`, `microsoft-entra-id`, `apple`, `facebook`.
Apple wymaga wygenerowania client secret (JWT) — patrz dokumentacja Auth.js.

## Struktura

```
src/app/                 strony (server components) + actions.ts (server actions)
  premiery/ best-of/     listy z importu
  album/[mbid]/          płyta: skład, utwory, oceny, komentarze, "więcej od artysty"
  artist/[mbid]/         zespół LUB muzyk: członkowie / zespoły, dyskografia, "grał na płytach"
  szukaj/ listy/ ja/     wyszukiwarka, listy społeczności, profil i preferencje
  go/release/[id]        z pozycji premier na stronę płyty (dopasowanie MBID w locie)
src/lib/musicbrainz.ts   klient MB + normalizacja (skład z relacji nagrań)
src/lib/user-data.ts     oceny, komentarze, preferencje (Drizzle)
src/lib/pns-parser.ts    parser SECTIONS/BEST z purenewshit.html
src/db/schema.ts         schemat bazy
scripts/import-pns.ts    import premier/best of
tests/                   testy jednostkowe (fixture'y MB) + e2e (Playwright)
```

## Testy

```bash
npm test                 # jednostkowe: klient MB na fixture'ach, parser
npm run typecheck
# e2e (wymaga bazy i serwera dev z fixture'ami):
MB_FIXTURES=tests/fixtures/mb npm run dev &
node tests/e2e.mjs
```

`MB_FIXTURES=<katalog>` przełącza klienta MusicBrainz na pliki (`tests/make-fixtures.ts` je generuje).

## Aktualizacja premier

Piątkowe zadanie publikuje nowy `purenewshit.html`. Wystarczy:

```bash
npm run import:pns -- /sciezka/purenewshit.html   # albo URL, jeśli plik jest publiczny
```

Sekcje o tym samym id są nadpisywane, starsze zostają jako **archiwum tygodni** (`/premiery?sekcja=archiwum`). Dopasowania MBID dla niezmienionych pozycji są zachowywane.

## Produkcja

- `npm run build && npm start` (albo Vercel + Neon/Supabase Postgres; ustaw `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, klucze OAuth, `MUSICBRAINZ_USER_AGENT` z kontaktem).
- `AUTH_DEV_LOGIN` **nie** ustawiaj na produkcji (i tak jest wyłączone przy `NODE_ENV=production`).
- Migracje: `npm run db:migrate`.

## Ograniczenia i pomysły

- Jakość składów zależy od MusicBrainz — dla wielu metalowych płyt są tylko członkowie zespołu, bez relacji na poziomie nagrań. Strona płyty wtedy odsyła do składu zespołu i do Metal-Archives.
- „Grał na płytach” dla muzyka korzysta z przeglądania nagrań po artyście w MB (do 500 nagrań).
- Do zrobienia: Discogs jako uzupełnienie credits (token w `.env` już przewidziany), powiadomienia o premierach ulubionych artystów, rekomendacje z wag stylów i lubianych płyt, oznaczanie „słuchałem”.
