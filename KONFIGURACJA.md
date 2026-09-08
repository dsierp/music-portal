# Portal — konfiguracja i obsługa

Ściąga: co gdzie jest, jak to uruchomić i gdzie szukać, kiedy przestanie działać.
Żadnych haseł ani kluczy tutaj nie ma — są tylko wskazówki, gdzie one siedzą.

---

## Adresy

| Co | Gdzie |
|---|---|
| Portal (produkcja) | https://www.music-travel.app — `music-travel.app` przekierowuje na `www` |
| Adres zapasowy | https://music-portal-five.vercel.app |
| Kod | https://github.com/dsierp/music-portal (gałąź `main`) |
| Kod lokalnie | `~/Documents/GitHub/music-portal` |
| Hosting | Vercel, zespół **rogaty**, projekt **music-portal** |
| Baza w chmurze | Neon, projekt **music-portal**, gałąź **production** |
| Logowanie Google | Google Cloud, projekt **music-travel** → Google Auth Platform |

---

## Jak to działa w dwóch zdaniach

Kod leży na GitHubie. Każdy `git push` na gałąź `main` uruchamia build na Vercelu
i — jeśli przejdzie — automatycznie publikuje nową wersję portalu. Dane
(premiery, best of, konta, oceny) leżą w bazie Postgres na Neonie; portal łączy
się z nią adresem ze zmiennej `DATABASE_URL`.

---

## Codzienna praca

```bash
cd ~/Documents/GitHub/music-portal
npm run dev            # lokalnie na http://localhost:3000
```

Zmiana → commit → `git push` → po minucie widać ją na `music-travel.app`.
Postęp wdrożenia: Vercel → **Deployments**.

**Ważne:** zmiana zmiennej środowiskowej na Vercelu NIE działa od razu.
Trzeba potem zrobić **Deployments → „…" → Redeploy**, bo Vercel nie wstrzykuje
zmiennych do już zbudowanej wersji. To najczęstsze źródło „przecież poprawiłem,
a dalej źle".

---

## Baza danych

Portal ma dwie bazy i wybiera je sam, po zmiennej `DATABASE_URL`:

| `DATABASE_URL` | Co się dzieje |
|---|---|
| puste | **PGlite** — Postgres w pliku, lokalnie, bez instalowania czegokolwiek |
| adres Neona | **Neon** — baza w chmurze, ta sama, z której korzysta produkcja |

Tak jest to ustawione dziś: w `.env` na Twoim macu `DATABASE_URL` jest **puste**
(czyli lokalnie pracujesz na PGlite), a adres do Neona siedzi osobno jako
`NEON_DATABASE_URL` i używa go wyłącznie `npm run neon:setup`. Dzięki temu praca
offline nie zależy od chmury, a chmura nie zależy od tego, co majstrujesz u
siebie.

Lokalna baza PGlite leży w
`~/Library/Application Support/music-portal/pglite`.
**Nie w Dokumentach** — tam iCloud podmieniał pliki pod nogami i baza psuła się
trzy razy.

### Napełnienie bazy w chmurze

```bash
npm run neon:setup     # migracje → import PNS → dowiązanie MBID-ów
```

Kroki po kolei, z opisem na ekranie. Można puszczać wielokrotnie: import
nadpisuje po id, a dowiązywanie pomija to, co już dowiązane. Trwa kilka minut,
bo MusicBrainz przepuszcza jedno zapytanie na sekundę.

### Pojedyncze komendy

| Komenda | Co robi |
|---|---|
| `npm run db:migrate` | zakłada/aktualizuje tabele |
| `npm run import:pns -- data/purenewshit.html` | wczytuje premiery i best of z zestawienia |
| `npm run resolve:mbids` | dowiązuje pozycje do MusicBrainz (okładki, składy) |
| `npm run fetch:releases` | dociąga premiery z MB dla kategorii spoza zestawienia |
| `npm run db:backup` | zapisuje JSON-em Twoje dane (konta, oceny, komentarze, ulubione) |
| `npm run db:restore -- <plik>` | dopisuje dane z kopii (nie kasuje istniejących) |
| `npm run db:reset` | robi kopię, odkłada uszkodzoną bazę na bok i buduje od zera |
| `npm run db:studio` | podgląd bazy w przeglądarce |

Kopie lądują obok bazy, w podkatalogu `backups/`. **Warto zrobić kopię przed
każdą większą zmianą** — reszta bazy odtworzy się z importu, ale oceny i
komentarze istnieją tylko tam.

---

## Zmienne środowiskowe

Dwa miejsca: plik `.env` na Twoim macu (lokalnie) i Vercel → *Settings →
Environment Variables* (produkcja). `.env` jest w `.gitignore`, więc nie trafia
do repozytorium.

| Zmienna | Do czego | Gdzie ustawiona |
|---|---|---|
| `DATABASE_URL` | adres bazy | Vercel: adres Neona. Lokalnie: puste (PGlite) |
| `NEON_DATABASE_URL` | adres Neona dla `neon:setup` | tylko lokalnie |
| `AUTH_SECRET` | podpisywanie sesji | Vercel i lokalnie, **różne wartości** |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | logowanie Google | Vercel i lokalnie |
| `MUSICBRAINZ_USER_AGENT` | MB wymaga, żeby aplikacja się przedstawiła | Vercel i lokalnie |
| `AUTH_DEV_LOGIN` | logowanie „wpisz e-mail" bez OAuth | **tylko lokalnie, nigdy na produkcji** |
| `DISCOGS_TOKEN` | uzupełnianie składów z Discogs | nieużywane (puste) |
| `AUTH_APPLE_*`, `AUTH_FACEBOOK_*`, `AUTH_MICROSOFT_*` | inni dostawcy logowania | nieustawione |

### Pułapki, na które już wpadliśmy

- **Pusta zmienna to nie to samo co brak zmiennej.** Import całego `.env` do
  Vercela wciąga też puste wpisy. Tak zniknął User-Agent MusicBrainzu (portal
  przedstawiał się jako nikt i dostawał 403) i tak DATABASE_URL przyjechał pusty.
  Jak coś działa lokalnie, a nie działa na produkcji — sprawdź to najpierw.
- **`AUTH_URL` jest niepotrzebne** i skasowane. Portal ma `trustHost`, więc
  adres rozpoznaje z zapytania. Pusta wartość tej zmiennej wywracała logowanie.
- **`AUTH_DEV_LOGIN` na produkcji to katastrofa** — każdy wpisuje dowolny e-mail
  i wchodzi jako kto chce. Kod dodatkowo tego pilnuje (działa tylko poza
  produkcją), ale zmiennej i tak tam nie trzymaj.

---

## Logowanie (Google)

Google Cloud → projekt **music-travel** → **Google Auth Platform**:

- **Branding** — nazwa i e-maile widoczne na ekranie zgody
- **Audience** — status publikacji (jest **In production**)
- **Clients** — klient „portal", w nim adresy powrotne

Adresy powrotne, które muszą się zgadzać co do znaku:

```
https://www.music-travel.app/api/auth/callback/google
https://music-travel.app/api/auth/callback/google
http://localhost:3000/api/auth/callback/google
```

Gdy Google zwróci `redirect_uri_mismatch`, to znaczy dokładnie tyle, że adres,
z którego przyszło zapytanie, nie jest na tej liście.

Portal włącza dostawcę logowania automatycznie — pokazuje przycisk tylko wtedy,
gdy widzi **obie** zmienne (`ID` i `SECRET`) niepuste. Brak przycisku = brak
kluczy w tym środowisku.

Apple i Facebook są w kodzie gotowe, wystarczy dodać klucze. Apple wymaga
płatnego konta developerskiego (99 USD/rok) i sekretu, który wygasa po pół roku.

---

## Skąd biorą się dane

| Źródło | Po co | Ograniczenia |
|---|---|---|
| Zestawienie „Pure New Shit" (`data/purenewshit.html`) | premiery tygodnia i best of | plik lokalny, import ręczny |
| MusicBrainz | płyty, artyści, składy, produkcja, relacje | **1 zapytanie/s**, wymaga User-Agenta z kontaktem |
| Cover Art Archive | okładki | bez limitu |
| Wikipedia / Wikidata | opisy, składy, loga zespołów, oceny z recenzji | — |

Gdy MusicBrainz nie odpowiada, wyszukiwarka i tak pokazuje sekcję „W portalu",
czyli to, co jest już w bazie.

---

## Kiedy coś nie działa

1. **Vercel → Logs** — tam lądują błędy z produkcji. Filtr „Error".
2. Błędy logowania są podpisane `[auth]` i mówią wprost, co Auth.js odrzucił
   (np. `MissingSecret`), zamiast samego „problem with the server configuration".
3. Błędy bazy w skryptach są tłumaczone na polski razem z kodem Postgresa —
   np. „Tabela nie istnieje — najpierw `npm run db:migrate` na TEJ SAMEJ bazie".
4. `npm run build` lokalnie **przed** pushem wyłapuje to, co i tak wywali
   wdrożenie (Vercel traktuje ostrzeżenia lintera jak błędy).

---

## Do zrobienia

- **Piątek 3:00 na serwerze.** Odświeżanie premier chodzi dziś z Twojego maca.
  Docelowo endpoint + `vercel.json` z wpisem crona. Uwaga: darmowy plan Vercela
  puszcza crona najwyżej raz dziennie i z dokładnością ±59 minut, a czas liczy
  w UTC (3:00 w Warszawie = 1:00 UTC).
- **Hasło do Neona do zmiany.** Przewinęło się przez czat. Neon → Roles →
  `neondb_owner` → reset, potem podmiana w `.env` i na Vercelu.
- **Sekret Google też warto odświeżyć** — Google Auth Platform → Clients →
  portal → nowy sekret, podmiana w obu miejscach. Nie wylogowuje nikogo.
- **Polityka prywatności i regulamin.** Portal zbiera e-maile użytkowników,
  więc przy publicznym użyciu będą potrzebne (i Google czasem o nie pyta).
