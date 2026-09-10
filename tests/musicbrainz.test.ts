import { test } from "node:test";
import assert from "node:assert/strict";
process.env.MB_FIXTURES = "tests/fixtures/mb";
// `||=`, nie `??=`: pusta zmienna z .env przeszłaby dalej i testy poszłyby na
// prawdziwą bazę PGlite (czyli wolno, a przy zajętym katalogu — wcale).
process.env.DATABASE_URL ||= "postgresql://invalid";
import { getAlbum, getArtist, getDiscography, getPlayedOn, findAlbumMbid, searchAlbums, buildLinks, normalizeUserAgent, artistQuery, isMembershipRelation, isMusicianRole } from "../src/lib/musicbrainz";
import { ID } from "./make-fixtures";

test("album: skład z relacji nagrań, najwcześniejsze wydanie, linki", async () => {
  const a = await getAlbum(ID.rg);
  assert.equal(a.title, "Goh-Ka");
  assert.equal(a.artistText, "Sigh");
  assert.equal(a.releaseMbid, ID.rel, "wybiera najwcześniejsze oficjalne wydanie");
  assert.equal(a.tracks.length, 3);
  assert.deepEqual(a.labels, ["Peaceville"]);
  assert.deepEqual(a.mbRating, { value: 4.25, votes: 8 }, "ocena społeczności MusicBrainz");
  const mirai = a.credits.find((c) => c.mbid === ID.mirai)!;
  assert.deepEqual(mirai.roles.sort(), ["keyboard", "lead vocals", "shamisen"]);
  assert.equal(mirai.onAllTracks, true);
  const mika = a.credits.find((c) => c.mbid === ID.mika)!;
  assert.equal(mika.trackCount, 2);
  assert.equal(mika.onAllTracks, false);
  const prod = a.credits.find((c) => c.mbid === ID.producer)!;
  assert.deepEqual(prod.roles, ["producer"]);
  assert.equal(a.credits[a.credits.length - 1].mbid, ID.producer, "produkcja na końcu");
  assert.equal(a.links.spotify, "https://open.spotify.com/album/abc", "bezpośredni link ze streaming rel");
  assert.match(a.links.tidal, /tidal\.com\/search/);
  assert.equal(a.links.wikidata, "https://www.wikidata.org/wiki/Q999");
  assert.deepEqual(a.genres, ["avant-garde metal", "black metal"]);
});

test("artysta-zespół: członkowie obecni/dawni, linki", async () => {
  const s = await getArtist(ID.band);
  assert.equal(s.isPerson, false);
  assert.equal(s.members.length, 3);
  assert.equal(s.members[0].current, true);
  assert.equal(s.members[2].name, "Satoshi Fujinami");
  assert.equal(s.members[2].current, false);
  assert.deepEqual(s.members[0].roles, ["vocals", "keyboard"], "atrybut 'original' odfiltrowany");
  assert.equal(s.links.wikipedia, "https://en.wikipedia.org/wiki/Sigh_(band)");
  assert.equal(s.links.official, "https://sigh.example");
  assert.match(s.links.metalArchives!, /metal-archives/);
});

test("artysta-osoba: zespoły i płyty, na których grał (bez własnych)", async () => {
  const p = await getArtist(ID.mirai);
  assert.equal(p.isPerson, true);
  assert.equal(p.memberOf[0].mbid, ID.band);
  const { items: played, wiecej } = await getPlayedOn(ID.mirai, p.memberOf);
  assert.equal(wiecej, false, "przy garstce wyników nie ma czego doczytywać");
  assert.equal(played.length, 2);
  assert.equal(played[0].album.title, "Other Album", "gościnne najpierw");
  assert.equal(played[0].withBand, null);
  assert.deepEqual(played[0].roles, ["keyboard"]);
  assert.equal(played[1].withBand, "Sigh");
});

test("producent: praca przy wydaniach, nie tylko granie", async () => {
  const a = await getArtist(ID.mirai);
  const w = a.workedOn.find((x) => x.title === "Goh-Ka");
  assert.ok(w, "relacja przy wydaniu powinna trafić do workedOn");
  assert.deepEqual(w!.roles, ["producer"]);
  assert.equal(w!.artistText, "Sigh");
  assert.equal(w!.date, "1993-05-01");
});

test("dyskografia: sortowanie albumów od najnowszego", async () => {
  const d = await getDiscography(ID.band);
  assert.deepEqual(d.map((x) => x.title), ["Goh-Ka", "Scorn Defeat"]);
});

test("wyszukiwanie i dopasowanie premier", async () => {
  const f = await findAlbumMbid("Sigh", "Goh-Ka");
  assert.equal(f?.mbid, ID.rg);
  const s = await searchAlbums("sigh", 15);
  assert.equal(s[0].year, "2026");
});

test("buildLinks: wyszukiwanie gdy brak relacji; AllMusic dla jazzu", () => {
  const l = buildLinks(undefined, "John Coltrane A Love Supreme", true);
  assert.match(l.spotify, /open\.spotify\.com\/search\/John%20Coltrane/);
  assert.ok(l.allmusic);
  assert.equal(l.metalArchives, undefined);
});

test("User-Agent: pusta zmienna nie kończy się pustym nagłówkiem", () => {
  // Dokładnie ten przypadek wyłączył portal na produkcji: zmienna istniała,
  // ale była pusta, a `??` łapie tylko brak zmiennej.
  for (const empty of [undefined, "", "   ", '""', "''"]) {
    const ua = normalizeUserAgent(empty as string | undefined);
    assert.ok(ua.length > 10, `pusto dla ${JSON.stringify(empty)}`);
    assert.match(ua, /PureNewShit/);
  }
});

test("User-Agent: własna wartość przechodzi, cudzysłowy z importu .env obcięte", () => {
  assert.equal(normalizeUserAgent('"MusicPortal/0.1 (a@b.pl)"'), "MusicPortal/0.1 (a@b.pl)");
  assert.equal(normalizeUserAgent("  MusicPortal/0.2 (a@b.pl)  "), "MusicPortal/0.2 (a@b.pl)");
});

test("szukanie artystów: zakres zawęża zapytanie do typu", () => {
  assert.equal(artistQuery("cynic"), "cynic", "domyślnie dokładnie — rozmycie przeciąża MusicBrainz");
  assert.equal(artistQuery("cynic", "group"), "cynic AND type:group");
  assert.equal(artistQuery("scott burns", "person"), "scott burns AND type:person");
  assert.equal(artistQuery("blink-182", "group"), "blink 182 AND type:group", "myślnik nie trafia do zapytania");
  assert.equal(artistQuery("cynic", undefined, true), "(cynic OR cynic~)", "rozmycie na żądanie");
  assert.equal(artistQuery("sun ra", undefined, true), "sun ra", "krótkie słowa bez rozmycia");
  assert.equal(artistQuery("   ", "person"), "", "puste zapytanie nie idzie do MB");
});

test("relacje 'grał z': sideman liczy się tak samo jak członek zespołu", () => {
  // Bez tych dwóch typów znikało granie Bordina u Ozzy'ego (1996–2010) i u Korn.
  assert.equal(isMembershipRelation("member of band"), true);
  assert.equal(isMembershipRelation("instrumental supporting musician"), true);
  assert.equal(isMembershipRelation("vocal supporting musician"), true);
  // …ale nie wszystko: produkcja to osobna sekcja strony.
  assert.equal(isMembershipRelation("producer"), false);
  assert.equal(isMembershipRelation("teacher"), false);
});

test("kredyty przy wydaniach: granie odpada, wydania tej samej płyty scalone", async () => {
  const a = await getArtist(ID.mirai);
  // Sekcja „Produkcja, realizacja, okładki" ma nie zawierać grania — na stronie
  // Vinnie Colaiuty trzy czwarte pozycji to były bębny.
  for (const w of a.workedOn) {
    for (const rola of w.roles) assert.equal(isMusicianRole(rola), false, `granie w produkcji: ${rola}`);
  }
  const klucze = a.workedOn.map((w) => `${w.title.toLowerCase()}|${(w.date ?? "").slice(0, 4)}`);
  assert.equal(new Set(klucze).size, klucze.length, "ta sama płyta nie powtarza się przez reedycje");
});
