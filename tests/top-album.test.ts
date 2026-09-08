import { test } from "node:test";
import assert from "node:assert/strict";
import { topAlbum } from "../src/lib/musicbrainz.ts";

function album(mbid: string, year: string, mb?: { value: number; votes: number }) {
  return {
    mbid, title: mbid, credit: [], artistText: "Zespół",
    firstReleaseDate: `${year}-01-01`, year, primaryType: "Album", secondaryTypes: [],
    disambiguation: null, mbRating: mb ?? null,
  };
}

const DYSKOGRAFIA = [
  album("debiut", "1990", { value: 4.0, votes: 12 }),
  album("arcydzielo", "1993", { value: 4.8, votes: 40 }),
  album("slabe", "1999", { value: 2.5, votes: 9 }),
  album("swieze", "2024", { value: 5.0, votes: 1 }),
];

test("bez ocen niczego nie wskazujemy — zgadywanie to udawanie wiedzy", () => {
  assert.equal(topAlbum([album("a", "1990"), album("b", "1995")]), null);
});

test("gdy nie ma ocen w portalu, decyduje MusicBrainz", () => {
  const top = topAlbum(DYSKOGRAFIA);
  assert.equal(top?.album.mbid, "arcydzielo");
  assert.equal(top?.source, "musicbrainz");
});

test("piątka od jednej osoby nie robi arcydzieła", () => {
  // „swieze" ma 5.0, ale jeden głos — dlatego próg głosów.
  assert.notEqual(topAlbum(DYSKOGRAFIA)?.album.mbid, "swieze");
});

test("oceny z portalu biją MusicBrainz — to nasi ludzie i nasza skala", () => {
  const portal = new Map([["slabe", { avg: 9.5, count: 4 }]]);
  const top = topAlbum(DYSKOGRAFIA, portal);
  assert.equal(top?.album.mbid, "slabe");
  assert.equal(top?.source, "portal");
});

test("przy remisie w portalu wygrywa ta z większą liczbą głosów", () => {
  const portal = new Map([
    ["debiut", { avg: 8, count: 2 }],
    ["arcydzielo", { avg: 8, count: 11 }],
  ]);
  assert.equal(topAlbum(DYSKOGRAFIA, portal)?.album.mbid, "arcydzielo");
});
