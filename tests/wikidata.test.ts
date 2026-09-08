import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeDates, wdTime } from "../src/lib/wikidata.ts";

test("czas z Wikidanych czytamy z uwzględnieniem precyzji", () => {
  assert.equal(wdTime({ time: "+1997-01-01T00:00:00Z", precision: 11 }), "1997-01-01");
  assert.equal(wdTime({ time: "+1997-01-01T00:00:00Z", precision: 9 }), "1997", "sam rok, gdy tyle wiadomo");
  assert.equal(wdTime({ time: "+1997-06-01T00:00:00Z", precision: 10 }), "1997-06");
  assert.equal(wdTime({ time: "-0044-03-15T00:00:00Z", precision: 11 }), null, "przed naszą erą nie gramy");
  assert.equal(wdTime(undefined), null);
});

const SPANS = [
  { qid: "Q1", mbid: "mb-behemoth", label: "Behemoth", begin: "1997", end: null },
  { qid: "Q2", mbid: null, label: "Vader", begin: "1990", end: "1994" },
];

test("Wikidane uzupełniają dziury, ale nie nadpisują MusicBrainz", () => {
  const [got] = mergeDates([{ mbid: "mb-behemoth", name: "Behemoth", begin: "1996", end: null, current: true }], SPANS);
  assert.equal(got.begin, "1996", "data z MB zostaje — jedno źródło prawdy");
  assert.equal(got.datesFrom, undefined);
});

test("brakujący początek dobieramy po MBID", () => {
  const [got] = mergeDates([{ mbid: "mb-behemoth", name: "Behemoth", begin: null, end: null, current: true }], SPANS);
  assert.equal(got.begin, "1997");
  assert.equal(got.datesFrom, "wikidata", "trzeba powiedzieć, skąd to jest");
  assert.equal(got.current, true, "Wikidane nie znają końca, więc nadal gra");
});

test("bez MBID-u dopasowujemy po nazwie, a znaleziony koniec kasuje „obecnie\"", () => {
  const [got] = mergeDates([{ mbid: "inny-mbid", name: "vader", begin: null, end: null, current: true }], SPANS);
  assert.equal(got.begin, "1990");
  assert.equal(got.end, "1994");
  assert.equal(got.current, false);
});

test("puste Wikidane nic nie psują", () => {
  const items = [{ mbid: "a", name: "A", begin: null, end: null, current: true }];
  assert.deepEqual(mergeDates(items, []), items);
});
