import { test } from "node:test";
import assert from "node:assert/strict";
import { concertWindow, tmGenres, dedupe, type Concert } from "../src/lib/concerts";

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
