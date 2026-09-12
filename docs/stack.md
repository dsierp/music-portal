# Portal muzyczny — co siedzi w środku

Ściąga techniczna: na czym to stoi, gdzie co leży, czym się to uruchamia.
Stan na wrzesień 2026.

## W skrócie

| Warstwa | Rozwiązanie |
|---|---|
| Język | TypeScript 5 |
| Framework | Next.js 15.5 (App Router, React 19, Server Components + server actions) |
| Style | Tailwind CSS 4 (klasy własne w `src/app/globals.css`: `.btn`, `.card`, `.label`) |
| Baza | PostgreSQL — **Neon** na produkcji, **PGlite** lokalnie (ta sama schema) |
| ORM | Drizzle ORM 0.45 + drizzle-kit (migracje w `drizzle/`) |
| Logowanie | NextAuth 5 (beta) + `@auth/drizzle-adapter` |
| Model językowy | OpenRouter albo Anthropic API (`src/lib/ai.ts`) |
| Walidacja | zod 3 |
| Testy | wbudowany `node --test` przez `tsx` (`tests/*.test.ts`) |
| Hosting | Vercel (funkcje serverless), domena `music-travel.app` |
| Skrypty | `tsx scripts/*.ts` — import danych, migracje, sprzątanie bufora |

Zero zewnętrznego Reduxa, zero tRPC, zero osobnego backendu. Wszystko idzie
przez Server Components i server actions — formularze działają też bez
JavaScriptu.

## Baza danych

Jedna schema (`src/db/schema.ts`), dwa silniki:

- **lokalnie** PGlite — Postgres skompilowany do WASM, leży jako katalog plików
  w `~/Library/Application Support/music-portal/pglite`. Nic nie trzeba
  instalować, nie ma serwera. Wybierany, gdy `DATABASE_URL` jest puste.
- **produkcja** Neon — Postgres serverless, sterownik `pg`. Wybierany przez
  `DATABASE_URL`.

Wybór siedzi w `src/db/index.ts` — reszta kodu nie wie, na czym jedzie.

### Tabele

**Konta i gust:** `user`, `account`, `session`, `verification_token` (wymagane
przez NextAuth), `user_genre`, `liked_album`, `favorite_artist`, `user_area`.

**Treść własna:** `rating`, `comment`, `list`, `list_item`, `list_visit`,
`list_share` — podróże, przystanki, odhaczanie, udostępnianie.

**Dane wsadowe:** `release_section`, `release` (premiery z Pure New Shit),
`best_of_year`, `best_of_entry`.

**Bufor:** `api_cache` — klucz → JSON + TTL. Trzyma odpowiedzi MusicBrainz,
Wikipedii, Cover Art Archive i stany zadań w tle.

### Zasada, która trzyma całość

**Nie budujemy własnej bazy wiedzy.** Baza trzyma tylko to, co należy do
użytkownika: kto on jest, co lubi, co ocenił, jakie ma listy. Cała wiedza
o muzyce jest pobierana z sieci i wpada do `api_cache` — z terminem ważności.

`api_cache` **musi** sam po sobie sprzątać. Raz tego zabrakło i tabela dobiła
do limitu Neona (512 MB): baza odmówiła zapisów, a odczyty dławiły się tak, że
strony wisiały minutami. Teraz: max 31 dni, max 256 kB na wpis, sprzątanie
losowo przy 2% zapisów + `npm run cache:sweep`.

## Logowanie

NextAuth 5, dostawca włącza się **sam, gdy ma klucze w env** (`src/lib/auth.ts`):
Google, Microsoft Entra ID, Apple, Facebook, Spotify. Plus `Credentials` jako
logowanie deweloperskie (`AUTH_DEV_LOGIN`).

Spotify jest podwójny: to i sposób logowania, i sposób PODŁĄCZENIA konta
(czytanie bieżącego utworu, tworzenie prywatnych playlist).

## Model językowy

`src/lib/ai.ts` — jedna funkcja `zapytaj()`, dwa możliwe źródła:
`OPENROUTER_API_KEY` albo `ANTHROPIC_API_KEY`. Domyślnie Claude Haiku.
Przy porażce próbuje maksymalnie 3 modeli (lista darmowych ciągnięta z katalogu
OpenRoutera), potem oddaje błąd.

Wynik modelu **nigdy nie trafia na ekran bez potwierdzenia**: każda płyta musi
się znaleźć w MusicBrainz, inaczej wypada. `wyluskaj()` ratuje ucięty JSON.

Ekrany AI: `/rozmowa` (rozmowa o muzyce) i `/podroze/nieznane`. Robota leci
w `after()` z `maxDuration = 60`, stan w `api_cache` — można wyjść ze strony
i wrócić.

## Źródła zewnętrzne

| Źródło | Do czego | Plik |
|---|---|---|
| MusicBrainz | prawda o płytach, składach, wydaniach (1 zapytanie/s!) | `musicbrainz.ts` |
| Cover Art Archive | okładki | `musicbrainz.ts` |
| Wikipedia / Wikidata | opisy, dyskografie, luki w składach | `wikipedia.ts`, `wikidata.ts` |
| Spotify Web API | linki do płyt, playlisty | `spotify.ts` |
| Deezer | uzupełnienie okładek | `deezer.ts` |
| Ticketmaster | koncerty | `concerts.ts` |
| Pure New Shit | premiery tygodnia (import z HTML) | `pns-parser.ts` |

## Zmienne środowiskowe

```
DATABASE_URL                 # puste = PGlite lokalnie; Neon na produkcji
AUTH_URL, AUTH_SECRET
AUTH_GOOGLE_ID / _SECRET
AUTH_MICROSOFT_ENTRA_ID_ID / _SECRET
AUTH_APPLE_ID / _SECRET
AUTH_FACEBOOK_ID / _SECRET
SPOTIFY_CLIENT_ID / _SECRET
AUTH_DEV_LOGIN               # logowanie na hasło, tylko lokalnie
OPENROUTER_API_KEY | ANTHROPIC_API_KEY
OPENROUTER_MODEL | ANTHROPIC_MODEL
MUSICBRAINZ_USER_AGENT       # wymagane przez MusicBrainz
EXTERNAL_RATINGS_USER_AGENT
TICKETMASTER_API_KEY
NEXT_PUBLIC_SITE_URL
PORTAL_ADMINS                # adresy e-mail administratorów
PODROZE_DZIENNIE, ROZMOWY_DZIENNIE   # limity kosztowe na użytkownika
```

Sekrety trzymamy w Vercelu (Settings → Environment Variables) i lokalnie
w `.env.local` / `.env.production.local`. `.gitignore` łapie `.env*`.

## Komendy

```
npm run dev              # serwer lokalny (PGlite)
npm run build            # build produkcyjny
npm test                 # testy
npm run typecheck        # tsc --noEmit
npm run db:generate      # nowa migracja z diffu schematu
npm run db:migrate:local # migracje na PGlite
npm run db:migrate:prod  # migracje na Neonie (czyta .env.production.local)
npm run db:studio        # przeglądarka bazy
npm run import:pns       # import premier z HTML Pure New Shit
npm run fetch:releases   # dociągnięcie premier
npm run cache:sweep      # sprzątanie bufora
```

## Układ katalogów

```
src/app/          strony (App Router), actions.ts = server actions
src/app/go/       przekierowania do Spotify/Tidala liczone przy kliknięciu
src/components/   komponenty (serwerowe domyślnie, "use client" tam gdzie trzeba)
src/lib/          cała logika: źródła danych, AI, bufor, i18n
src/lib/dict/     tłumaczenia — pl definiuje typ, więc brak klucza psuje build
src/db/           schema + wybór silnika
drizzle/          migracje SQL
scripts/          narzędzia uruchamiane przez tsx
tests/            node --test
```

## Cztery rzeczy, które warto przenieść do każdej następnej apki

1. **PGlite lokalnie, Postgres na produkcji** — ta sama schema, zero setupu na
   laptopie, zero dockerów.
2. **Server actions zamiast API** — formularz wysyła się sam, działa bez JS,
   nie ma osobnej warstwy endpointów do utrzymywania.
3. **Bufor z terminem ważności zamiast własnej bazy wiedzy** — dane z sieci
   wpadają do jednej tabeli klucz→JSON i po miesiącu znikają.
4. **Długa robota w `after()` z własnym adresem** — zadanie przeżywa wyjście
   ze strony, ekran tylko czyta jego stan. Musi mieć limit czasu ciszy,
   inaczej kręciołek kręci się w nieskończoność.
