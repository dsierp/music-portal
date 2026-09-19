# Własna kopia MusicBrainz

Po co: publiczny MusicBrainz przyjmuje **1 zapytanie na sekundę na całą aplikację**
(liczone po adresie IP, więc żadne „przedstawianie się inaczej" tego nie omija — a łamie
ich zasady i grozi odcięciem portalu). Przy kilkuset osobach naraz to jest sufit.
MusicBrainz sam przewidział wyjście: replikowaną kopię bazy u siebie. Wtedy limitu nie ma
wcale, a odpowiedzi idą w milisekundach zamiast sekundy plus kolejka.

## Co jest potrzebne

- Serwer (VPS) z Dockerem: **4 GB RAM** (2 GB da radę, ale wolno), **~40 GB dysku** na
  wariant `mbdata` (sama baza, bez indeksu wyszukiwania) albo **~100 GB** z wyszukiwarką.
- Darmowe konto na https://metabrainz.org → token do replikacji (Live Data Feed).
  Do niekomercyjnego użytku jest za darmo; przy komercyjnym trzeba się z nimi dogadać.
- Pierwsze wypełnienie bazy trwa **kilka godzin**. Potem replikacja dociąga zmiany
  co godzinę, samo.

## Postawienie

```bash
git clone https://github.com/metabrainz/musicbrainz-docker.git
cd musicbrainz-docker
sudo docker compose up -d db                      # sama baza na start
admin/configure add replication-token             # wklej token z metabrainz.org
sudo docker compose run --rm musicbrainz createdb.sh -fetch   # kilka godzin
sudo docker compose up -d                          # całość, z API na porcie 5000
admin/set-replication-schedule hourly              # dociąganie zmian co godzinę
```

Sprawdzenie, że żyje (powinno oddać „Metallica"):

```bash
curl -s 'http://localhost:5000/ws/2/artist/65f4f0c5-ef9e-490c-aee3-909e7ae6b2ab?fmt=json' | head -c 200
```

Wyszukiwanie po nazwie (`/ws/2/artist?query=…`) wymaga dodatkowo indeksu — bez niego
działają tylko odpytania po MBID. Portal używa OBU, więc indeks jest potrzebny:

```bash
admin/configure add search
sudo docker compose up -d
sudo docker compose exec indexer python -m sir reindex   # długie, raz
```

## Podpięcie portalu

Kopia **nie może** stać otworem na cały internet — to twoja usługa, nie publiczna.
Wystaw ją po prywatnej sieci albo za hasłem na reverse proxy (adres z hasłem w URL-u
też zadziała, ale wtedy trzymaj go wyłącznie w zmiennych środowiskowych).

W Vercelu (Production) dodaj dwie zmienne i zrób **Redeploy**:

```
MUSICBRAINZ_BASE_URL=https://twoja-kopia.example/ws/2
MUSICBRAINZ_MIN_GAP_MS=0
```

Bez tych zmiennych nic się nie zmienia — portal idzie do musicbrainz.org z odstępem
1,1 s, dokładnie jak dotąd. Odstęp jest osobno, bo kopia na słabym serwerze też może
chcieć oddechu: wtedy wpisz np. `100` zamiast `0`.

Sprawdzenie po wdrożeniu (jako administrator): **`/api/diag/mb`** — pokazuje adres,
odstęp i czas jednej prawdziwej odpowiedzi. Kopia: kilka–kilkadziesiąt ms.
Publiczny serwis: setki ms plus kolejka. Strona krzyczy też, gdy ktoś ustawi adres
kopii, a zapomni wyzerować odstęp.

## Czego to NIE załatwia

- Okładki idą z Cover Art Archive (osobny serwis) — kopia ich nie zawiera.
- Wikipedia, Wikidata, Spotify, Deezer, Ticketmaster — bez zmian, własne limity.
- Bufor w bazie portalu zostaje i dalej jest potrzebny: nawet własnej kopii nie chcemy
  pytać przy każdym wejściu na stronę.
