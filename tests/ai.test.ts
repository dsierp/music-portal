import { strict as assert } from "node:assert";
import { test } from "node:test";
import { parsujPropozycje, AiError } from "../src/lib/ai.ts";

test("wyciąga listę, gdy model opakuje ją w blok kodu i zdanie", () => {
  const p = parsujPropozycje('Proszę bardzo:\n```json\n[{"artist":"Gorguts","album":"Obscura","why":"dysonans"}]\n```');
  assert.equal(p.length, 1);
  assert.equal(p[0].album, "Obscura");
});

test("odrzuca pozycje bez artysty albo tytułu", () => {
  const p = parsujPropozycje('[{"artist":"","album":"X","why":"a"},{"artist":"Y","album":"","why":"b"},{"artist":"A","album":"B","why":"c"}]');
  assert.deepEqual(p.map((x) => x.album), ["B"]);
});

test("brak listy to błąd, a nie pusta tablica", () => {
  assert.throws(() => parsujPropozycje("Nie mam pomysłu."), AiError);
  assert.throws(() => parsujPropozycje("[to nie jest json]"), AiError);
});
