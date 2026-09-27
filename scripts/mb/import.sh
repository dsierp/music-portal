#!/usr/bin/env bash
# Import MusicBrainz do Neona — gotowe odpowiedzi w schemacie `mb`.
#
# Co robi, po kolei:
#   1. bierze najnowszy pełny zrzut MusicBrainz (dwa archiwa: core i derived)
#      i wypakowuje w locie tylko potrzebne tabele — archiwów nie zapisuje;
#   2. ładuje je do ROBOCZEJ bazy (lokalny Postgres, nie Neon);
#   3. przelicza na gotowe odpowiedzi (przeksztalc.sql → schemat mb_nowe);
#   4. przerzuca mb_nowe do Neona i dopiero na końcu, jednym ruchem,
#      podmienia `mb`. Portal nigdy nie widzi połowy danych: albo stara
#      kopia, albo nowa.
#
# Gdy cokolwiek pęknie po drodze, `mb` w Neonie zostaje nietknięte.
#
# Zmienne:
#   DATABASE_URL     — Neon (docelowa). Wymagana.
#   ROBOCZA_URL      — robocza baza Postgres 16 (domyślnie lokalny docker).
#   MB_DUMP_BASE     — skąd zrzut (domyślnie data.metabrainz.org).
#   MB_CREATE_TABLES — skąd CreateTables.sql (URL albo ścieżka).
#   MB_MIN_ARTYSTOW  — poniżej tylu artystów nie podmieniamy (ochrona przed
#                      pustym albo uciętym zrzutem). Domyślnie 1 000 000.
#   WORK             — katalog roboczy.
set -euo pipefail

: "${DATABASE_URL:?Brak DATABASE_URL (Neon)}"
# Sekret wklejany ze schowka łatwo łapie końcowy znak nowej linii — psql
# czyta go wtedy jako część ostatniego parametru („channel_binding=require\n")
# i odmawia. Obcinamy białe znaki z obu końców, zanim cokolwiek z nim zrobimy.
DATABASE_URL=$(printf '%s' "$DATABASE_URL" | tr -d '\r\n' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
ROBOCZA_URL=${ROBOCZA_URL:-postgresql://postgres:robocza@localhost:5432/postgres}
MB_DUMP_BASE=${MB_DUMP_BASE:-https://data.metabrainz.org/pub/musicbrainz/data/fullexport}
MB_CREATE_TABLES=${MB_CREATE_TABLES:-https://raw.githubusercontent.com/metabrainz/musicbrainz-server/master/admin/sql/CreateTables.sql}
MB_MIN_ARTYSTOW=${MB_MIN_ARTYSTOW:-1000000}
WORK=${WORK:-$PWD/mbwork}
TU=$(cd "$(dirname "$0")" && pwd)
# Bez gadania o „schema does not exist, skipping" — w logu mają zostać rzeczy ważne.
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"

# Neon: do przerzucania schematu idziemy bez poolera — pg_restore i zmiany
# schematu przez pgbouncera w trybie transakcyjnym potrafią się wysypać.
NEON=${DATABASE_URL/-pooler./.}

CORE=(artist artist_type area iso_3166_1 artist_alias artist_credit artist_credit_name
      release_group release_group_primary_type release_group_secondary_type
      release_group_secondary_type_join release release_country release_unknown_country
      link link_type link_attribute link_attribute_type
      l_artist_artist l_artist_url l_artist_release l_artist_release_group url genre)
# Tagi i oceny siedzą w archiwum „derived". Szukamy wszystkiego w obu —
# nie zakładamy na sztywno, w którym archiwum MusicBrainz trzyma którą tabelę.
DERIVED=(tag artist_tag release_group_meta)
WSZYSTKIE=("${CORE[@]}" "${DERIVED[@]}")

# lbzip2 rozpakowuje na wszystkich rdzeniach — przy kilku GB to różnica
# kilkunastu minut. Zwykły bzip2 też zadziała, tylko wolniej.
BZ=$(command -v lbzip2 || command -v bzip2)

krok() { printf '\n==> %s  [%s]\n' "$*" "$(date -u +%H:%M:%S)"; }
robocza() { psql -X -q -v ON_ERROR_STOP=1 "$ROBOCZA_URL" "$@"; }
neon() { psql -X -q -v ON_ERROR_STOP=1 "$NEON" "$@"; }

mkdir -p "$WORK"
cd "$WORK"

# Połączenie z Neonem sprawdzamy NA POCZĄTKU — pierwszy import wywalił się
# na nim dopiero po pół godzinie pobierania i przeliczania.
krok "Połączenie z Neonem"
neon -At -c "select 'ok: ' || current_database() || ', Postgres ' || current_setting('server_version')"

krok "Który zrzut"
ZRZUT=$(curl -fsSL "$MB_DUMP_BASE/LATEST" | tr -d '[:space:]')
[ -n "$ZRZUT" ] || { echo "Pusty LATEST"; exit 1; }
echo "Zrzut: $ZRZUT"

krok "Schemat tabel (CreateTables.sql)"
if [[ "$MB_CREATE_TABLES" == http* ]]; then
  curl -fsSL -o CreateTables.sql "$MB_CREATE_TABLES"
else
  cp "$MB_CREATE_TABLES" CreateTables.sql
fi

wypakuj() {
  local archiwum=$1
  local czlonki=()
  for t in "${WSZYSTKIE[@]}"; do
    [ -f "mbdump/$t" ] || czlonki+=("mbdump/$t")
  done
  [ ${#czlonki[@]} -gt 0 ] || return 0
  krok "Pobieram i wypakowuję $archiwum (${#czlonki[@]} tabel do znalezienia)"
  set +e
  curl -fsSL "$MB_DUMP_BASE/$ZRZUT/$archiwum" | "$BZ" -dc | tar -x -f - "${czlonki[@]}" 2> tar.log
  local st=("${PIPESTATUS[@]}")
  set -e
  if [ "${st[0]}" != 0 ] || [ "${st[1]}" != 0 ]; then
    echo "Pobieranie albo rozpakowanie $archiwum padło (curl=${st[0]}, rozpakowanie=${st[1]})"
    cat tar.log
    exit 1
  fi
  # tar kończy się błędem, gdy nie znalazł któregoś pliku — to jest w porządku,
  # tej tabeli poszukamy w drugim archiwum. Każdy INNY komunikat to awaria.
  if grep -v -e 'Not found in archive' -e 'Exiting with failure status' tar.log | grep -q .; then
    cat tar.log
    exit 1
  fi
}

wypakuj mbdump.tar.bz2
wypakuj mbdump-derived.tar.bz2

for t in "${WSZYSTKIE[@]}"; do
  [ -f "mbdump/$t" ] || { echo "Brak tabeli $t w żadnym archiwum zrzutu $ZRZUT"; exit 1; }
done
du -sh mbdump

krok "Tabele surowe w bazie roboczej"
python3 "$TU/tabele.py" CreateTables.sql "${WSZYSTKIE[@]}" | robocza

for t in "${WSZYSTKIE[@]}"; do
  echo "  $t ($(du -h "mbdump/$t" | cut -f1))"
  robocza -c "\\copy src.$t from 'mbdump/$t'"
  rm -f "mbdump/$t"   # miejsce na dysku maszyny importu jest policzone
done

krok "Przeliczenie na gotowe odpowiedzi"
robocza -f "$TU/przeksztalc.sql"
robocza -c "insert into mb_nowe.stan values ('zrzut', '$ZRZUT')"
robocza -At -c "select klucz || ': ' || wartosc from mb_nowe.stan order by klucz"

ILE=$(robocza -At -c "select count(*) from mb_nowe.artysta")
if [ "$ILE" -lt "$MB_MIN_ARTYSTOW" ]; then
  echo "Tylko $ILE artystów (minimum $MB_MIN_ARTYSTOW) — coś jest nie tak ze zrzutem. Nie podmieniam."
  exit 1
fi

krok "Zrzut schematu mb_nowe"
pg_dump -Fc --no-owner --no-privileges -n mb_nowe -f mb_nowe.dump "$ROBOCZA_URL"
ls -lh mb_nowe.dump

krok "Wgrywam do Neona (obok, jako mb_nowe)"
neon -c "drop schema if exists mb_nowe cascade"
pg_restore --no-owner --no-privileges -j 4 -d "$NEON" mb_nowe.dump

NEON_ILE=$(neon -At -c "select count(*) from mb_nowe.artysta")
[ "$NEON_ILE" = "$ILE" ] || { echo "W Neonie $NEON_ILE artystów, a miało być $ILE. Nie podmieniam."; exit 1; }

krok "Podmiana mb ← mb_nowe"
neon <<'SQL'
begin;
drop schema if exists mb_stare cascade;
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'mb') then
    execute 'alter schema mb rename to mb_stare';
  end if;
end $$;
alter schema mb_nowe rename to mb;
commit;
drop schema if exists mb_stare cascade;
SQL

neon -At -c "select klucz || ': ' || wartosc from mb.stan order by klucz"
neon -At -c "select 'mb w Neonie: ' || pg_size_pretty(sum(pg_total_relation_size(c.oid))) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'mb' and c.relkind = 'r'"
krok "Gotowe"
