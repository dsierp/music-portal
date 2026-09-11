import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDiscographyLine } from "../src/lib/wikitext.ts";

test("czyta linie z zespolem, tytulem i rokiem", () => {
  const l = parseDiscographyLine("* [[Death (band)|Death]] – ''[[Leprosy (album)|Leprosy]]'' (1988)");
  assert.deepEqual(l, { band: "Death", title: "Leprosy", year: "1988" });
});

test("odcina ogonek EP", () => {
  const l = parseDiscographyLine("* Massacre – ''Inhuman Condition'' EP (1992)");
  assert.equal(l?.title, "Inhuman Condition");
});

test("radzi sobie z rokiem z przodu", () => {
  const l = parseDiscographyLine("* 1990 – Death – Spiritual Healing");
  assert.deepEqual(l, { band: "Death", title: "Spiritual Healing", year: "1990" });
});

test("linia bez roku to nie plyta", () => {
  assert.equal(parseDiscographyLine("* Pracował w studiu Morrisound w Tampie."), null);
});
