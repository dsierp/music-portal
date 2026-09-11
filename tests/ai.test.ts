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

test("ratuje urwana odpowiedz — bierze to, co kompletne", () => {
  // Model wyczerpal limit znakow w polowie trzeciej pozycji.
  const urwane = '[{"artist":"Coroner","album":"No More Color","why":"a"},{"artist":"Voivod","album":"Nothingface","why":"b"},{"artist":"Toxik","album":"Think Th';
  const p = parsujPropozycje(urwane);
  assert.deepEqual(p.map((x) => x.artist), ["Coroner", "Voivod"]);
});

test("niedajaca sie odczytac odpowiedz prosi o inny model", () => {
  try {
    parsujPropozycje("kompletne smieci bez nawiasow");
    assert.fail("powinno rzucic");
  } catch (e) {
    assert.ok(e instanceof AiError);
    assert.equal((e as AiError).doPodmiany, true);
  }
});
