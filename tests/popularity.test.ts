import { test } from "node:test";
import assert from "node:assert/strict";
import { sortByPopularity, FALLBACK_ORDER } from "../src/lib/popularity";

test("bez głosów decyduje lista zapasowa — najpierw najszerzej słuchane", () => {
  const out = sortByPopularity(["black", "pop", "jazz", "death"], new Map());
  assert.deepEqual(out, ["pop", "jazz", "death", "black"]);
});

test("głosy użytkowników biją listę zapasową", () => {
  const votes = new Map([["black", 9], ["jazz", 2]]);
  assert.deepEqual(sortByPopularity(["pop", "jazz", "black"], votes), ["black", "jazz", "pop"]);
});

test("nieznane style (świeże z MusicBrainz) lądują na końcu, alfabetycznie", () => {
  const out = sortByPopularity(["shoegaze", "pop", "ambient"], new Map());
  assert.deepEqual(out, ["pop", "ambient", "shoegaze"]);
});

test("lista zapasowa zna wszystkie kategorie profilu", () => {
  for (const slug of ["pop", "hiphop", "electronic", "folk", "country", "classical", "jazz", "prog", "punk", "other", "death", "black"]) {
    assert.ok(FALLBACK_ORDER.includes(slug), slug);
  }
});
