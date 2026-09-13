import { test } from "node:test";
import assert from "node:assert/strict";
import { tenSamArtysta, tenSamTytul } from "../src/lib/musicbrainz.ts";

test("sito: artysta musi się zgadzać", () => {
  // To jest ten błąd: „Der Weg Einer Freiheit" trafiało na płytę „Justice Der".
  assert.equal(tenSamArtysta("Justice Der", "Der Weg Einer Freiheit"), false);
  assert.equal(tenSamArtysta("Inferno", "Terrestrial Hospice"), false);
  assert.equal(tenSamArtysta("Deicide", "Decide"), false);

  // A to są trafienia, których nie wolno wyrzucić.
  assert.equal(tenSamArtysta("Der Weg einer Freiheit", "Der Weg Einer Freiheit"), true);
  assert.equal(tenSamArtysta("Motörhead", "Motorhead"), true);
  assert.equal(tenSamArtysta("Opeth", "opeth"), true);
  assert.equal(tenSamArtysta("Opeth feat. Mikael Åkerfeldt", "Opeth"), true);
  assert.equal(tenSamArtysta("Emperor & Enslaved", "Emperor and Enslaved"), true);
  assert.equal(tenSamArtysta("The Ocean", "Ocean"), true);
});

test("sito: tytuł z dopiskiem w nawiasie to ten sam tytuł", () => {
  assert.equal(tenSamTytul("Innern", "Innern (Instrumental)"), true);
  assert.equal(tenSamTytul("Omnicide - Chapter I", "Omnicide – Chapter I"), true);
  assert.equal(tenSamTytul("Blackwater Park", "Blackwater Park (Remastered)"), true);
  assert.equal(tenSamTytul("Blackwater Park", "blackwater park"), true);

  assert.equal(tenSamTytul("Covers II", "Innern"), false);
  assert.equal(tenSamTytul("Watershed", "Deliverance"), false);
});
