import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parsePureNewShit, sectionSortDate } from "../src/lib/pns-parser";

test("parser Pure New Shit: sekcje, wiersze, best of", () => {
  const d = parsePureNewShit(fs.readFileSync("data/purenewshit.html", "utf8"));
  assert.equal(d.sections.length, 2);
  assert.equal(d.sections[0].title, "Piątek");
  assert.ok(d.sections[0].releases.length > 10);
  const sigh = d.sections[0].releases.find((r) => r[0] === "sigh")!;
  assert.equal(sigh[3], "Sigh");
  assert.equal(sigh[4], "Goh-Ka");
  assert.equal(Object.keys(d.best).length, 2);
  assert.equal(d.best["2026"].cats.death.length, 10);
  assert.equal(sectionSortDate("05.09 – 11.09.2026").toISOString().slice(0, 10), "2026-09-11");
  assert.equal(sectionSortDate("04.09.2026").toISOString().slice(0, 10), "2026-09-04");
});

test("parser: nawiasy w stringach nie psują balansu", () => {
  const html = `<script>const SECTIONS = [{id:"x", releases:[["a","db",1,"A]","B[","L","desc ] {","r"]]}];
const BEST = {"2026":{label:"2026",cats:{death:[]}}}; const BEST_CATS = {death:"D"};</script>`;
  const d = parsePureNewShit(html);
  assert.equal(d.sections[0].releases[0][3], "A]");
});
