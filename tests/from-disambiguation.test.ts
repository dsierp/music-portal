import { test } from "node:test";
import assert from "node:assert/strict";
import { zespolyZOpisu } from "../src/lib/from-disambiguation.ts";

test("wyciąga zespół z opisu przy artyście", () => {
  assert.deepEqual(zespolyZOpisu("drummer of Mgła"), ["Mgła"]);
  assert.deepEqual(zespolyZOpisu("bassist of Behemoth"), ["Behemoth"]);
  assert.deepEqual(zespolyZOpisu("drummer of Mgła and Kriegsmaschine"), ["Mgła", "Kriegsmaschine"]);
});

test("ucina dopowiedzenia — nazwa to nie zdanie", () => {
  assert.deepEqual(zespolyZOpisu("drummer of Mgła (Polish black metal)"), ["Mgła"]);
  assert.deepEqual(zespolyZOpisu("guitarist of Vader since 1996"), ["Vader"]);
  assert.deepEqual(zespolyZOpisu("drummer of Mgła — one of the best in the genre"), ["Mgła"]);
});

test("gdy opis nie mówi o zespole, wolimy nic nie pokazać", () => {
  assert.deepEqual(zespolyZOpisu("Polish drummer"), []);
  assert.deepEqual(zespolyZOpisu("US session musician"), []);
  assert.deepEqual(zespolyZOpisu(null), []);
  assert.deepEqual(zespolyZOpisu(""), []);
});
