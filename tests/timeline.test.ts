import { test } from "node:test";
import assert from "node:assert/strict";
import { fillMissingSpans, mergeSpans, rowRoles } from "../src/lib/timeline.ts";

/** Skrót do wpisu członkostwa — tyle, ile scalanie potrzebuje. */
function m(mbid: string, name: string, begin: string | null, end: string | null, roles: string[] = []) {
  return { mbid, name, begin, end, current: end === null, roles };
}

// Atheist w MusicBrainz: Choy wchodzi i wychodzi cztery razy, Shaefer dwa,
// Flynn dwa. Wykres robił z tego cztery, dwa i dwa wiersze.
const ATHEIST = [
  m("choy", "Tony Choy", "1991-01", "1992-01", ["bass guitar"]),
  m("choy", "Tony Choy", "1993-01", "1994-01", ["bass guitar"]),
  m("choy", "Tony Choy", "2006-01", "2010-01", ["bass guitar"]),
  m("choy", "Tony Choy", "2012-01", null, ["guitar"]),
  m("shaefer", "Kelly Shaefer", "1987-01", "1993-06", ["guitar"]),
  m("shaefer", "Kelly Shaefer", "2006-01", null, ["lead vocals"]),
  m("flynn", "Steve Flynn", "1987-01", "1992-01", ["drums (drum set)"]),
  m("flynn", "Steve Flynn", "2006-01", null, ["drums (drum set)"]),
  m("patterson", "Roger Patterson", "1987-01", "1991-02", ["bass guitar"]),
];

test("jedna osoba = jeden wiersz, nawet przy kilku członkostwach", () => {
  const rows = mergeSpans(ATHEIST);
  assert.equal(rows.length, 4, "cztery osoby, nie dziewięć wierszy");
  const choy = rows.find((r) => r.mbid === "choy")!;
  assert.equal(choy.spans.length, 4, "wszystkie odcinki Choya zostają — przerwy mają być widoczne");
});

test("odcinki w wierszu idą chronologicznie, wiersze po dacie wejścia", () => {
  const rows = mergeSpans(ATHEIST);
  // trzej weterani zaczęli w tym samym miesiącu — remis rozstrzyga nazwa
  assert.deepEqual(rows.map((r) => r.mbid), ["shaefer", "patterson", "flynn", "choy"]);
  const choy = rows.find((r) => r.mbid === "choy")!;
  assert.deepEqual(choy.spans.map((s) => s.begin), ["1991-01", "1993-01", "2006-01", "2012-01"]);
  assert.equal(choy.spans.at(-1)!.current, true, "ostatni odcinek trwa do dziś");
});

test("wiersz zbiera instrumenty ze wszystkich odcinków", () => {
  const rows = mergeSpans(ATHEIST);
  const shaefer = rows.find((r) => r.mbid === "shaefer")!;
  assert.deepEqual(rowRoles(shaefer), ["guitar", "lead vocals"]);
});

test("znaczniki płyt liczone raz na wiersz, nie raz na członkostwo", () => {
  const rows = mergeSpans(ATHEIST, (x) => [{ id: `plyta-${x.mbid}` }]);
  const choy = rows.find((r) => r.mbid === "choy")!;
  assert.deepEqual(choy.marks, [{ id: "plyta-choy" }]);
});

// --- daty odczytane z płyt ---------------------------------------------------

test("zespół bez dat członkostwa dostaje okres z własnych płyt", () => {
  const rows = mergeSpans(
    [m("behemoth", "Behemoth", null, null)],
    () => [{ date: "1995-03-01" }, { date: "2018-10-05" }, { date: "2004-09-06" }],
  );
  const [row] = fillMissingSpans(rows);
  assert.ok(row, "wiersz ma zostać — Inferno gra w Behemocie, choć MB nie ma dat");
  assert.equal(row.spans.length, 1);
  assert.equal(row.spans[0].begin, "1995-03-01");
  assert.equal(row.spans[0].end, "2018-10-05");
  assert.equal(row.spans[0].inferred, true, "trzeba oznaczyć, że to daty z płyt, nie z członkostwa");
});

test("bez dat i bez płyt nie ma czego rysować", () => {
  const rows = mergeSpans([m("x", "Zespół widmo", null, null)]);
  assert.deepEqual(fillMissingSpans(rows), []);
});

test("prawdziwe daty członkostwa mają pierwszeństwo przed płytami", () => {
  const rows = mergeSpans(
    [m("b", "Band", "1990-01", "1995-01")],
    () => [{ date: "1980-01-01" }, { date: "2020-01-01" }],
  );
  const [row] = fillMissingSpans(rows);
  assert.equal(row.spans[0].begin, "1990-01");
  assert.ok(!row.spans[0].inferred);
});
