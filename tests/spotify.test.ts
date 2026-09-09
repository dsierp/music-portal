import test from "node:test";
import assert from "node:assert/strict";
import { rozbijEtykiete } from "../src/lib/spotify.ts";

test("etykieta przystanku: artysta i tytuł", () => {
  assert.deepEqual(rozbijEtykiete("Mgła – Exercises in Futility"), { artist: "Mgła", title: "Exercises in Futility" });
  assert.deepEqual(rozbijEtykiete("Sting — Sacred Love"), { artist: "Sting", title: "Sacred Love" });
});

test("etykieta bez myślnika to sam tytuł", () => {
  assert.deepEqual(rozbijEtykiete("Kingdom of Ants"), { artist: "", title: "Kingdom of Ants" });
});

test("myślnik w nazwie nie rozbija etykiety w złym miejscu", () => {
  // „Jean-Luc Ponty" ma dywiz bez spacji — dzielimy tylko po myślniku ze spacjami.
  assert.deepEqual(rozbijEtykiete("Jean-Luc Ponty – Aurora"), { artist: "Jean-Luc Ponty", title: "Aurora" });
});

test("płyta z myślnikiem w tytule zostaje w całości", () => {
  assert.deepEqual(rozbijEtykiete("Opeth – Damnation – Reissue"), { artist: "Opeth", title: "Damnation – Reissue" });
});
