import { test } from "node:test";
import assert from "node:assert/strict";
import { acceptedLabels, concertWindow, dedupe, inAnyArea, matchesGenres, offGenre, tmGenres, type Concert } from "../src/lib/concerts";

test("okno koncertów to dokładnie trzy miesiące od dziś", () => {
  const w = concertWindow(new Date("2026-09-08T22:00:00Z"));
  assert.equal(w.from, "2026-09-08");
  assert.equal(w.to, "2026-12-08");
});

test("okno przeskakuje rok i radzi sobie z krótszym miesiącem", () => {
  assert.equal(concertWindow(new Date("2026-11-30T10:00:00Z")).to, "2027-03-02"); // luty ma 28 dni
  assert.equal(concertWindow(new Date("2026-12-31T10:00:00Z")).from, "2026-12-31");
});

test("kategorie profilu → gatunki Ticketmastera, bez powtórek", () => {
  // death, black i „inne metal" to u nas trzy kategorie, ale jeden gatunek w TM.
  assert.deepEqual(tmGenres(["death", "black", "other"]), ["Metal"]);
  assert.deepEqual(tmGenres(["jazz", "prog"]), ["Jazz", "Rock"]);
  assert.deepEqual(tmGenres(["nie-ma-takiej"]), []);
});

const c = (over: Partial<Concert>): Concert => ({
  id: Math.random().toString(), name: "Behemoth", date: "2026-10-04", time: null,
  city: "Warszawa", country: "PL", venue: "Stodoła", url: null, source: "ticketmaster", genres: [], ...over,
});

test("ten sam koncert z dwóch źródeł zostaje raz", () => {
  const out = dedupe([c({ source: "ticketmaster" }), c({ source: "musicbrainz", id: "mb:1" })]);
  assert.equal(out.length, 1);
});

test("koncerty wychodzą w kolejności dat", () => {
  const out = dedupe([c({ date: "2026-11-01", name: "B" }), c({ date: "2026-09-20", name: "A" })]);
  assert.deepEqual(out.map((x) => x.date), ["2026-09-20", "2026-11-01"]);
});

test("lista ulubionych zawęża po nazwie miasta i po kraju", () => {
  const warszawa = c({ city: "Warszawa", country: "PL", venue: "Stodoła" });
  const berlin = c({ city: "Berlin", country: "DE", venue: "SO36" });
  // MusicBrainz podaje nazwę obszaru, nie kod kraju — stąd dopasowanie po nazwie.
  assert.equal(inAnyArea(warszawa, [{ country: "PL", city: "Warszawa" }]), true);
  assert.equal(inAnyArea(berlin, [{ country: "PL", city: "Warszawa" }]), false);
  assert.equal(inAnyArea(berlin, [{ country: "DE", city: null }]), true);
});

test("puste obszary nie zawężają niczego", () => {
  const anywhere = c({ city: "Tokio", country: "JP" });
  assert.equal(inAnyArea(anywhere, []), false, "pusta lista nie pasuje…");
  // …a wywołujący traktuje pustą listę jako „bez filtra" (patrz concertsForFavorites).
});

// --- „to nie są moje gatunki" -------------------------------------------------

test("szeroki Rock z listy nie przepuszcza pop-rocka", () => {
  // Prog rock i As December Falls to dla Ticketmastera ten sam „Rock" — dlatego
  // dopasowujemy po podgatunkach, nie po korzeniu drzewa.
  const moje = acceptedLabels(["prog", "death"]);
  const popRock = { id: "1", name: "As December Falls", date: "2026-09-17", time: null, city: "Krakow", country: "PL", venue: null, url: null, source: "ticketmaster" as const, genres: ["Rock", "Pop"] };
  const prog = { ...popRock, id: "2", genres: ["Progressive Rock"] };
  const death = { ...popRock, id: "3", genres: ["Metal", "Death Metal/Black Metal"] };
  assert.equal(matchesGenres(popRock, moje), false);
  assert.equal(matchesGenres(prog, moje), true);
  assert.equal(matchesGenres(death, moje), true, "podgatunek węższy niż „Metal” ma się łapać");
});

test("koncert bez etykiet zostaje — o nim nic nie wiadomo", () => {
  const mb = { id: "mb:1", name: "DeViLs", date: "2026-09-13", time: null, city: null, country: "PL", venue: "Kwadrat", url: null, source: "musicbrainz" as const, genres: [] };
  assert.equal(matchesGenres(mb, acceptedLabels(["death"])), true);
  assert.equal(offGenre(mb, acceptedLabels(["death"])), false);
});

test("bez wybranych kategorii nie filtrujemy niczego", () => {
  const c = { id: "1", name: "X", date: "2026-09-17", time: null, city: null, country: "PL", venue: null, url: null, source: "ticketmaster" as const, genres: ["Pop"] };
  assert.equal(matchesGenres(c, acceptedLabels([])), true);
});

test("koncert z Ticketmastera dla ulubionego zespołu ma być w obszarze", () => {
  // Napalm Death, Kraków — TM ma to w bazie, MusicBrainz nie. Sekcja ulubionych
  // pytała dotąd tylko MB i dlatego świeciła pustką.
  const nd = {
    id: "tm:1", name: "Napalm Death | Support: Master, Brat, Goatburner", date: "2026-11-20",
    time: "18:30", city: "Krakow", country: "PL", venue: "Hype Park", url: null,
    source: "ticketmaster" as const, genres: ["Rock", "Pop", "Metal"],
  };
  assert.equal(inAnyArea(nd, [{ country: "PL", city: null }]), true, "cały kraj obejmuje Kraków");
  assert.equal(inAnyArea(nd, [{ country: "PL", city: "Kraków" }]), true, "miasto po polsku też ma się łapać");
  assert.equal(inAnyArea(nd, [{ country: "DE", city: null }]), false);
});
