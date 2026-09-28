-- Przeliczenie surowego zrzutu MusicBrainz (schemat src, same TEXT-y)
-- na gotowe odpowiedzi dla portalu (schemat mb_nowe).
--
-- DLACZEGO GOTOWE ODPOWIEDZI, A NIE KOPIA TABEL: portal już umie czytać
-- odpowiedzi API MusicBrainz (/ws/2, JSON) — cała logika strony artysty
-- i dyskografii stoi na tym kształcie. Składamy więc dokładnie ten kształt
-- tutaj, na maszynie importu, gdzie złączenia milionów wierszy nic nie
-- kosztują. W Neonie zostaje jedna tabela = jeden odczyt po kluczu.
--
-- Odtwarzamy tylko pola, które portal czyta (patrz typy Mb* w
-- src/lib/musicbrainz.ts). Czego tu nie ma, portal i tak nie widział.
--
-- Uruchamiane raz na import, na świeżej bazie roboczej. Bez transakcji —
-- gdy coś pęknie, import się przerywa i nic nie trafia do Neona.

\set ON_ERROR_STOP 1
SET work_mem = '256MB';
SET maintenance_work_mem = '1GB';

DROP SCHEMA IF EXISTS pom CASCADE;
CREATE SCHEMA pom;
DROP SCHEMA IF EXISTS mb_nowe CASCADE;
CREATE SCHEMA mb_nowe;

-- Data w formie MusicBrainz: "1990", "1990-05", "1990-05-17".
CREATE FUNCTION pom.data(y text, m text, d text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN y IS NULL THEN NULL
    WHEN m IS NULL THEN lpad(y, 4, '0')
    WHEN d IS NULL THEN lpad(y, 4, '0') || '-' || lpad(m, 2, '0')
    ELSE lpad(y, 4, '0') || '-' || lpad(m, 2, '0') || '-' || lpad(d, 2, '0')
  END
$$;

-- ---------- słowniki ----------

CREATE TABLE pom.artist_type AS SELECT id::int, name FROM src.artist_type;
CREATE TABLE pom.rg_ptype AS SELECT id::int, name FROM src.release_group_primary_type;
CREATE TABLE pom.rg_stype AS SELECT id::int, name FROM src.release_group_secondary_type;
CREATE TABLE pom.link_type AS SELECT id::int, name, entity_type0, entity_type1 FROM src.link_type;
CREATE TABLE pom.attr_type AS SELECT id::int, name FROM src.link_attribute_type;
CREATE TABLE pom.area AS
  SELECT a.id::int, a.name, i.code
  FROM src.area a
  LEFT JOIN (SELECT DISTINCT ON (area) area::int AS area, code FROM src.iso_3166_1 ORDER BY area, code) i ON i.area = a.id::int;
CREATE UNIQUE INDEX ON pom.area (id);

-- ---------- artyści ----------

CREATE TABLE pom.artist AS
SELECT a.id::int AS id,
       a.gid::uuid AS gid,
       a.name,
       a.sort_name,
       t.name AS type,
       a.comment,
       a.area::int AS area,
       a.begin_area::int AS begin_area,
       pom.data(a.begin_date_year, a.begin_date_month, a.begin_date_day) AS begin_d,
       pom.data(a.end_date_year, a.end_date_month, a.end_date_day) AS end_d,
       a.ended = 't' AS ended
FROM src.artist a
LEFT JOIN pom.artist_type t ON t.id = a.type::int;
CREATE UNIQUE INDEX ON pom.artist (id);

-- Artysta jako cel relacji / część podpisu: to, co MB zagnieżdża.
CREATE TABLE pom.artist_mini AS
SELECT id,
       jsonb_build_object('id', gid, 'name', name, 'sort-name', sort_name, 'type', type,
                          'disambiguation', comment) AS j
FROM pom.artist;
CREATE UNIQUE INDEX ON pom.artist_mini (id);

-- ---------- podpisy (artist credit) ----------

CREATE TABLE pom.ac AS
SELECT n.artist_credit::int AS id,
       jsonb_agg(jsonb_build_object('name', n.name, 'joinphrase', n.join_phrase, 'artist', m.j)
                 ORDER BY n.position::int) AS j
FROM src.artist_credit_name n
JOIN pom.artist_mini m ON m.id = n.artist::int
GROUP BY n.artist_credit::int;
CREATE UNIQUE INDEX ON pom.ac (id);

-- ---------- wydania i daty ----------

-- Najwcześniejsza data wydania (z krajem albo bez) — tak jak "date" w /ws/2.
CREATE TABLE pom.rel_data AS
SELECT DISTINCT ON (release) release, y, m, d, country
FROM (
  SELECT c.release::int AS release, c.date_year::int AS y, c.date_month::int AS m, c.date_day::int AS d, ar.code AS country
  FROM src.release_country c LEFT JOIN pom.area ar ON ar.id = c.country::int
  UNION ALL
  SELECT u.release::int, u.date_year::int, u.date_month::int, u.date_day::int, NULL
  FROM src.release_unknown_country u
) x
WHERE y IS NOT NULL
ORDER BY release, y, m NULLS LAST, d NULLS LAST;
CREATE UNIQUE INDEX ON pom.rel_data (release);

CREATE TABLE pom.release AS
SELECT r.id::int AS id, r.gid::uuid AS gid, r.name, r.artist_credit::int AS ac, r.release_group::int AS rg,
       pom.data(d.y::text, d.m::text, d.d::text) AS date_s, d.y, d.m, d.d
FROM src.release r
LEFT JOIN pom.rel_data d ON d.release = r.id::int;
CREATE UNIQUE INDEX ON pom.release (id);
CREATE INDEX ON pom.release (rg);

-- Pierwsze wydanie całej płyty — "first-release-date" grupy.
CREATE TABLE pom.rg_first AS
SELECT DISTINCT ON (rg) rg, pom.data(y::text, m::text, d::text) AS date_s
FROM pom.release
WHERE y IS NOT NULL
ORDER BY rg, y, m NULLS LAST, d NULLS LAST;
CREATE UNIQUE INDEX ON pom.rg_first (rg);

CREATE TABLE pom.rg_stypes AS
SELECT j.release_group::int AS rg, jsonb_agg(s.name ORDER BY s.name) AS j
FROM src.release_group_secondary_type_join j
JOIN pom.rg_stype s ON s.id = j.secondary_type::int
GROUP BY j.release_group::int;
CREATE UNIQUE INDEX ON pom.rg_stypes (rg);

CREATE TABLE pom.rg AS
SELECT g.id::int AS id, g.gid::uuid AS gid, g.name, g.comment, g.artist_credit::int AS ac,
       p.name AS ptype, coalesce(s.j, '[]'::jsonb) AS stypes, f.date_s AS first_date,
       CASE WHEN m.rating IS NULL THEN NULL
            ELSE jsonb_build_object('value', round(m.rating::numeric / 20, 2), 'votes-count', coalesce(m.rating_count::int, 0)) END AS rating
FROM src.release_group g
LEFT JOIN pom.rg_ptype p ON p.id = g.type::int
LEFT JOIN pom.rg_stypes s ON s.rg = g.id::int
LEFT JOIN pom.rg_first f ON f.rg = g.id::int
LEFT JOIN src.release_group_meta m ON m.id = g.id;
CREATE UNIQUE INDEX ON pom.rg (id);
CREATE INDEX ON pom.rg (ac);

-- ---------- relacje ----------

CREATE TABLE pom.link AS
SELECT l.id::int AS id, t.name AS type,
       pom.data(l.begin_date_year, l.begin_date_month, l.begin_date_day) AS begin_d,
       pom.data(l.end_date_year, l.end_date_month, l.end_date_day) AS end_d,
       l.ended = 't' AS ended
FROM src.link l
JOIN pom.link_type t ON t.id = l.link_type::int;
CREATE UNIQUE INDEX ON pom.link (id);

CREATE TABLE pom.link_attrs AS
SELECT a.link::int AS link, jsonb_agg(t.name ORDER BY t.name) AS j
FROM src.link_attribute a
JOIN pom.attr_type t ON t.id = a.attribute_type::int
GROUP BY a.link::int;
CREATE UNIQUE INDEX ON pom.link_attrs (link);

-- Wspólny szkielet jednej relacji w kształcie /ws/2.
CREATE FUNCTION pom.rel(l pom.link, attrs jsonb, kierunek text, cel text) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'type', l.type, 'direction', kierunek, 'target-type', cel,
    'attributes', coalesce(attrs, '[]'::jsonb),
    'begin', l.begin_d, 'end', l.end_d, 'ended', l.ended)
$$;

CREATE UNLOGGED TABLE pom.rels (artist int NOT NULL, j jsonb NOT NULL);

-- artysta ↔ artysta, w obie strony (zespół widzi członków, członek zespoły)
INSERT INTO pom.rels
SELECT x.entity0::int, pom.rel(l, la.j, 'forward', 'artist') || jsonb_build_object('artist', m.j)
FROM src.l_artist_artist x
JOIN pom.link l ON l.id = x.link::int
LEFT JOIN pom.link_attrs la ON la.link = l.id
JOIN pom.artist_mini m ON m.id = x.entity1::int;

INSERT INTO pom.rels
SELECT x.entity1::int, pom.rel(l, la.j, 'backward', 'artist') || jsonb_build_object('artist', m.j)
FROM src.l_artist_artist x
JOIN pom.link l ON l.id = x.link::int
LEFT JOIN pom.link_attrs la ON la.link = l.id
JOIN pom.artist_mini m ON m.id = x.entity0::int;

-- artysta → adres (Wikipedia, Bandcamp, Discogs…)
INSERT INTO pom.rels
SELECT x.entity0::int, pom.rel(l, la.j, 'forward', 'url') || jsonb_build_object('url', jsonb_build_object('id', u.gid, 'resource', u.url))
FROM src.l_artist_url x
JOIN pom.link l ON l.id = x.link::int
LEFT JOIN pom.link_attrs la ON la.link = l.id
JOIN src.url u ON u.id = x.entity1;

-- artysta → wydanie (produkcja, realizacja, granie sesyjne przy wydaniu)
INSERT INTO pom.rels
SELECT x.entity0::int,
       pom.rel(l, la.j, 'forward', 'release')
       || jsonb_build_object('release', jsonb_build_object('id', r.gid, 'title', r.name, 'date', r.date_s, 'artist-credit', coalesce(ac.j, '[]'::jsonb)))
FROM src.l_artist_release x
JOIN pom.link l ON l.id = x.link::int
LEFT JOIN pom.link_attrs la ON la.link = l.id
JOIN pom.release r ON r.id = x.entity1::int
LEFT JOIN pom.ac ac ON ac.id = r.ac;

-- artysta → płyta (release group)
INSERT INTO pom.rels
SELECT x.entity0::int,
       pom.rel(l, la.j, 'forward', 'release_group')
       || jsonb_build_object('release-group', jsonb_build_object('id', g.gid, 'title', g.name, 'first-release-date', g.first_date, 'artist-credit', coalesce(ac.j, '[]'::jsonb)))
FROM src.l_artist_release_group x
JOIN pom.link l ON l.id = x.link::int
LEFT JOIN pom.link_attrs la ON la.link = l.id
JOIN pom.rg g ON g.id = x.entity1::int
LEFT JOIN pom.ac ac ON ac.id = g.ac;

CREATE INDEX ON pom.rels (artist);

CREATE TABLE pom.rels_agg AS
SELECT artist, jsonb_agg(j) AS j FROM pom.rels GROUP BY artist;
CREATE UNIQUE INDEX ON pom.rels_agg (artist);

-- ---------- gatunki, tagi, aliasy ----------

-- /ws/2 rozdziela „genres" (tagi z oficjalnej listy gatunków) od „tags" (reszta).
CREATE TABLE pom.tagi AS
SELECT at.artist::int AS artist, t.name, at.count::int AS cnt, (g.name IS NOT NULL) AS gatunek
FROM src.artist_tag at
JOIN src.tag t ON t.id = at.tag
LEFT JOIN (SELECT DISTINCT lower(name) AS name FROM src.genre) g ON g.name = lower(t.name)
WHERE at.count::int > 0;

CREATE TABLE pom.tagi_agg AS
SELECT artist,
       coalesce(jsonb_agg(jsonb_build_object('name', name, 'count', cnt) ORDER BY cnt DESC) FILTER (WHERE gatunek), '[]'::jsonb) AS genres,
       jsonb_agg(jsonb_build_object('name', name, 'count', cnt) ORDER BY cnt DESC) AS tags
FROM pom.tagi
GROUP BY artist;
CREATE UNIQUE INDEX ON pom.tagi_agg (artist);

CREATE TABLE pom.aliasy AS
SELECT artist::int AS artist,
       jsonb_agg(jsonb_build_object('name', name, 'primary', primary_for_locale = 't') ORDER BY primary_for_locale DESC, name) AS j
FROM src.artist_alias
GROUP BY artist::int;
CREATE UNIQUE INDEX ON pom.aliasy (artist);

-- ---------- gotowe: artysta ----------

CREATE TABLE mb_nowe.artysta AS
SELECT a.gid,
       jsonb_build_object(
         'id', a.gid,
         'name', a.name,
         'sort-name', a.sort_name,
         'type', a.type,
         'country', ar.code,
         'area', CASE WHEN ar.id IS NULL THEN NULL ELSE jsonb_build_object('name', ar.name) END,
         'begin-area', CASE WHEN ba.id IS NULL THEN NULL ELSE jsonb_build_object('name', ba.name) END,
         'disambiguation', a.comment,
         'life-span', jsonb_build_object('begin', a.begin_d, 'end', a.end_d, 'ended', a.ended),
         'genres', coalesce(t.genres, '[]'::jsonb),
         'tags', coalesce(t.tags, '[]'::jsonb),
         'aliases', coalesce(al.j, '[]'::jsonb),
         'relations', coalesce(r.j, '[]'::jsonb)
       ) AS doc
FROM pom.artist a
LEFT JOIN pom.area ar ON ar.id = a.area
LEFT JOIN pom.area ba ON ba.id = a.begin_area
LEFT JOIN pom.tagi_agg t ON t.artist = a.id
LEFT JOIN pom.aliasy al ON al.artist = a.id
LEFT JOIN pom.rels_agg r ON r.artist = a.id;
ALTER TABLE mb_nowe.artysta ADD PRIMARY KEY (gid);

-- ---------- gotowe: dyskografia artysty ----------

-- Płyty, w których podpisie artysta występuje — to samo, co przeglądanie
-- /ws/2/release-group?artist=…  Ten sam limit co w portalu (300), żeby
-- molochy w rodzaju „Various Artists" nie zjadały miejsca.
CREATE TABLE pom.rg_doc AS
SELECT g.id, g.ac, g.first_date,
       jsonb_build_object(
         'id', g.gid, 'title', g.name, 'primary-type', g.ptype, 'secondary-types', g.stypes,
         'first-release-date', coalesce(g.first_date, ''), 'disambiguation', g.comment,
         'artist-credit', coalesce(ac.j, '[]'::jsonb), 'rating', g.rating
       ) AS j
FROM pom.rg g
LEFT JOIN pom.ac ac ON ac.id = g.ac;
CREATE INDEX ON pom.rg_doc (ac);

CREATE TABLE pom.artist_ac AS
SELECT DISTINCT artist::int AS artist, artist_credit::int AS ac FROM src.artist_credit_name;
CREATE INDEX ON pom.artist_ac (artist);

CREATE TABLE mb_nowe.dyskografia AS
SELECT a.gid, d.doc
FROM (
  SELECT artist, jsonb_agg(j ORDER BY first_date NULLS LAST) AS doc
  FROM (
    SELECT x.artist, g.j, g.first_date,
           row_number() OVER (PARTITION BY x.artist ORDER BY g.first_date NULLS LAST, g.id) AS nr
    FROM pom.artist_ac x
    JOIN pom.rg_doc g ON g.ac = x.ac
  ) z
  WHERE nr <= 300
  GROUP BY artist
) d
JOIN pom.artist a ON a.id = d.artist;
ALTER TABLE mb_nowe.dyskografia ADD PRIMARY KEY (gid);


-- ---------- gotowe: płyta (release group) i jej wybrane wydanie ----------
--
-- Strona płyty pyta /ws/2 dwa razy: o grupę wydawniczą (tytuł, gatunki,
-- linki, lista wydań) i o JEDNO wydanie (utwory, kto grał, wytwórnia).
-- Które wydanie — wybiera `pickRelease` w portalu; tu robimy to samo w SQL,
-- żeby dla każdej płyty trzymać tylko to jedno, a nie wszystkie reedycje.

CREATE TABLE pom.rel_status AS SELECT id::int, name FROM src.release_status;
CREATE TABLE pom.med_format AS SELECT id::int, name FROM src.medium_format;

CREATE TABLE pom.rel_tc AS
SELECT release::int AS release, sum(track_count::int) AS tc
FROM src.medium GROUP BY release::int;
CREATE UNIQUE INDEX ON pom.rel_tc (release);

CREATE TABLE pom.rel_full AS
SELECT r.id, r.gid, r.name, r.ac, r.rg, r.date_s, d.country,
       st.name AS status, coalesce(tc.tc, 0) AS tc
FROM pom.release r
JOIN src.release sr ON sr.id::int = r.id
LEFT JOIN pom.rel_status st ON st.id = sr.status::int
LEFT JOIN pom.rel_data d ON d.release = r.id
LEFT JOIN pom.rel_tc tc ON tc.release = r.id;
CREATE INDEX ON pom.rel_full (rg);

-- pickRelease: najpierw oficjalne (albo bez statusu), z nich te z co najmniej
-- 60% utworów najpełniejszego, a z tych najwcześniejsze; remis — więcej utworów.
CREATE TABLE pom.wybrane AS
WITH p AS (
  SELECT f.*,
         (f.status IS NULL OR f.status = 'Official') AS zwykle,
         bool_or(f.status IS NULL OR f.status = 'Official') OVER (PARTITION BY f.rg) AS sa_zwykle
  FROM pom.rel_full f
), pula AS (
  SELECT * FROM p WHERE zwykle OR NOT sa_zwykle
), m AS (
  SELECT *, max(tc) OVER (PARTITION BY rg) AS maks FROM pula
)
SELECT DISTINCT ON (rg) rg, id AS release
FROM m
WHERE maks = 0 OR tc >= maks * 0.6
ORDER BY rg, coalesce(date_s, '9999'), tc DESC;
CREATE UNIQUE INDEX ON pom.wybrane (rg);
CREATE UNIQUE INDEX ON pom.wybrane (release);

-- adresy: grupa → URL, wydanie → URL, nagranie → URL
CREATE TABLE pom.url_rels AS
SELECT 'rg'::text AS co, x.entity0::int AS id,
       pom.rel(l, la.j, 'forward', 'url') || jsonb_build_object('url', jsonb_build_object('id', u.gid, 'resource', u.url)) AS j
FROM src.l_release_group_url x
JOIN pom.link l ON l.id = x.link::int
LEFT JOIN pom.link_attrs la ON la.link = l.id
JOIN src.url u ON u.id = x.entity1;
INSERT INTO pom.url_rels
SELECT 'rel', x.entity0::int,
       pom.rel(l, la.j, 'forward', 'url') || jsonb_build_object('url', jsonb_build_object('id', u.gid, 'resource', u.url))
FROM src.l_release_url x
JOIN pom.wybrane w ON w.release = x.entity0::int
JOIN pom.link l ON l.id = x.link::int
LEFT JOIN pom.link_attrs la ON la.link = l.id
JOIN src.url u ON u.id = x.entity1;
CREATE INDEX ON pom.url_rels (co, id);

-- gatunki i tagi płyty
CREATE TABLE pom.rg_tagi AS
SELECT t2.release_group::int AS rg,
       coalesce(jsonb_agg(jsonb_build_object('name', t.name, 'count', t2.count::int) ORDER BY t2.count::int DESC)
         FILTER (WHERE g.name IS NOT NULL), '[]'::jsonb) AS genres,
       jsonb_agg(jsonb_build_object('name', t.name, 'count', t2.count::int) ORDER BY t2.count::int DESC) AS tags
FROM src.release_group_tag t2
JOIN src.tag t ON t.id = t2.tag
LEFT JOIN (SELECT DISTINCT lower(name) AS name FROM src.genre) g ON g.name = lower(t.name)
WHERE t2.count::int > 0
GROUP BY t2.release_group::int;
CREATE UNIQUE INDEX ON pom.rg_tagi (rg);

CREATE TABLE pom.rg_wydania AS
SELECT rg, jsonb_agg(jsonb_build_object('id', gid, 'title', name, 'status', status, 'date', coalesce(date_s, ''),
                                        'country', country, 'track-count', tc) ORDER BY coalesce(date_s, '9999')) AS j
FROM (SELECT *, row_number() OVER (PARTITION BY rg ORDER BY coalesce(date_s, '9999')) AS nr FROM pom.rel_full) x
WHERE nr <= 100
GROUP BY rg;
CREATE UNIQUE INDEX ON pom.rg_wydania (rg);

CREATE TABLE mb_nowe.plyta AS
SELECT g.gid,
       (d.j - 'rating') || jsonb_build_object(
         'rating', coalesce(g.rating, jsonb_build_object('value', NULL, 'votes-count', 0)),
         'genres', coalesce(t.genres, '[]'::jsonb),
         'tags', coalesce(t.tags, '[]'::jsonb),
         'releases', coalesce(w.j, '[]'::jsonb),
         'relations', coalesce((SELECT jsonb_agg(u.j) FROM pom.url_rels u WHERE u.co = 'rg' AND u.id = g.id), '[]'::jsonb)
       ) AS doc
FROM pom.rg g
JOIN pom.rg_doc d ON d.id = g.id
LEFT JOIN pom.rg_tagi t ON t.rg = g.id
LEFT JOIN pom.rg_wydania w ON w.rg = g.id;
ALTER TABLE mb_nowe.plyta ADD PRIMARY KEY (gid);

-- nagrania z wybranych wydań: kto grał (relacje artysta→nagranie) i klipy
CREATE TABLE pom.med AS
SELECT m.id::int AS id, m.release::int AS release, m.position::int AS pos, f.name AS format, m.name
FROM src.medium m
JOIN pom.wybrane w ON w.release = m.release::int
LEFT JOIN pom.med_format f ON f.id = m.format::int;
CREATE UNIQUE INDEX ON pom.med (id);

CREATE UNLOGGED TABLE pom.trk AS
SELECT t.medium::int AS medium, t.position::int AS pos, t.number, t.name, t.length::int AS len,
       t.recording::int AS recording
FROM src.track t
JOIN pom.med m ON m.id = t.medium::int;
CREATE INDEX ON pom.trk (recording);
CREATE INDEX ON pom.trk (medium);

CREATE UNLOGGED TABLE pom.rec_rels (recording int NOT NULL, j jsonb NOT NULL);
INSERT INTO pom.rec_rels
SELECT x.entity1::int, pom.rel(l, la.j, 'backward', 'artist') || jsonb_build_object('artist', am.j)
FROM src.l_artist_recording x
JOIN (SELECT DISTINCT recording FROM pom.trk) r ON r.recording = x.entity1::int
JOIN pom.link l ON l.id = x.link::int
LEFT JOIN pom.link_attrs la ON la.link = l.id
JOIN pom.artist_mini am ON am.id = x.entity0::int;
INSERT INTO pom.rec_rels
SELECT x.entity0::int, pom.rel(l, la.j, 'forward', 'url') || jsonb_build_object('url', jsonb_build_object('id', u.gid, 'resource', u.url))
FROM src.l_recording_url x
JOIN (SELECT DISTINCT recording FROM pom.trk) r ON r.recording = x.entity0::int
JOIN pom.link l ON l.id = x.link::int
LEFT JOIN pom.link_attrs la ON la.link = l.id
JOIN src.url u ON u.id = x.entity1;
CREATE TABLE pom.rec_rels_agg AS SELECT recording, jsonb_agg(j) AS j FROM pom.rec_rels GROUP BY recording;
CREATE UNIQUE INDEX ON pom.rec_rels_agg (recording);

CREATE TABLE pom.rec AS
SELECT r.id::int AS id, r.gid, r.length::int AS len
FROM src.recording r
JOIN (SELECT DISTINCT recording FROM pom.trk) t ON t.recording = r.id::int;
CREATE UNIQUE INDEX ON pom.rec (id);

CREATE TABLE pom.med_doc AS
SELECT m.release,
       jsonb_agg(jsonb_build_object(
         'position', m.pos, 'format', m.format, 'title', m.name,
         'tracks', coalesce(tr.j, '[]'::jsonb)) ORDER BY m.pos) AS j
FROM pom.med m
LEFT JOIN (
  SELECT t.medium,
         jsonb_agg(jsonb_build_object(
           'position', t.pos, 'number', t.number, 'title', t.name, 'length', t.len,
           'recording', jsonb_build_object('id', rc.gid, 'length', rc.len, 'relations', coalesce(rr.j, '[]'::jsonb))
         ) ORDER BY t.pos) AS j
  FROM pom.trk t
  JOIN pom.rec rc ON rc.id = t.recording
  LEFT JOIN pom.rec_rels_agg rr ON rr.recording = t.recording
  GROUP BY t.medium
) tr ON tr.medium = m.id
GROUP BY m.release;
CREATE UNIQUE INDEX ON pom.med_doc (release);

CREATE TABLE pom.rel_etykiety AS
SELECT rl.release::int AS release,
       jsonb_agg(jsonb_build_object('label', CASE WHEN lb.id IS NULL THEN NULL ELSE jsonb_build_object('id', lb.gid, 'name', lb.name) END,
                                    'catalog-number', rl.catalog_number)) AS j
FROM src.release_label rl
JOIN pom.wybrane w ON w.release = rl.release::int
LEFT JOIN src.label lb ON lb.id = rl.label
GROUP BY rl.release::int;
CREATE UNIQUE INDEX ON pom.rel_etykiety (release);

-- relacje artysta→wydanie widziane OD STRONY WYDANIA (kierunek backward)
CREATE TABLE pom.rel_art_rels AS
SELECT x.entity1::int AS release,
       jsonb_agg(pom.rel(l, la.j, 'backward', 'artist') || jsonb_build_object('artist', am.j)) AS j
FROM src.l_artist_release x
JOIN pom.wybrane w ON w.release = x.entity1::int
JOIN pom.link l ON l.id = x.link::int
LEFT JOIN pom.link_attrs la ON la.link = l.id
JOIN pom.artist_mini am ON am.id = x.entity0::int
GROUP BY x.entity1::int;
CREATE UNIQUE INDEX ON pom.rel_art_rels (release);

CREATE TABLE mb_nowe.wydanie AS
SELECT g.gid AS rg_gid, f.gid,
       jsonb_build_object(
         'id', f.gid, 'title', f.name, 'date', coalesce(f.date_s, ''), 'country', f.country, 'status', f.status,
         'artist-credit', coalesce(ac.j, '[]'::jsonb),
         'label-info', coalesce(e.j, '[]'::jsonb),
         'relations', coalesce(ar.j, '[]'::jsonb)
           || coalesce((SELECT jsonb_agg(u.j) FROM pom.url_rels u WHERE u.co = 'rel' AND u.id = f.id), '[]'::jsonb),
         'media', coalesce(md.j, '[]'::jsonb)
       ) AS doc
FROM pom.wybrane w
JOIN pom.rel_full f ON f.id = w.release
JOIN pom.rg g ON g.id = w.rg
LEFT JOIN pom.ac ac ON ac.id = f.ac
LEFT JOIN pom.rel_etykiety e ON e.release = f.id
LEFT JOIN pom.rel_art_rels ar ON ar.release = f.id
LEFT JOIN pom.med_doc md ON md.release = f.id;
ALTER TABLE mb_nowe.wydanie ADD PRIMARY KEY (rg_gid);
CREATE INDEX ON mb_nowe.wydanie (gid);

-- ---------- stan importu ----------

CREATE TABLE mb_nowe.stan (klucz text PRIMARY KEY, wartosc text NOT NULL);
INSERT INTO mb_nowe.stan VALUES
  ('artysci', (SELECT count(*) FROM mb_nowe.artysta)::text),
  ('dyskografie', (SELECT count(*) FROM mb_nowe.dyskografia)::text),
  ('plyty', (SELECT count(*) FROM mb_nowe.plyta)::text),
  ('wydania', (SELECT count(*) FROM mb_nowe.wydanie)::text),
  ('przeliczono', now()::text);

DROP SCHEMA pom CASCADE;
