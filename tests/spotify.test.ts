import test from "node:test";
import assert from "node:assert/strict";
import { rozbijEtykiete, kluczTytulu, tylkoNoweTytuly } from "../src/lib/spotify.ts";

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

test("klucz tytułu: reedycje i remastery to ta sama płyta", () => {
  assert.equal(kluczTytulu("Damnation (Remastered)"), kluczTytulu("Damnation"));
  assert.equal(kluczTytulu("Still Life – Deluxe Edition"), kluczTytulu("Still Life"));
  assert.equal(kluczTytulu("Blackwater Park"), kluczTytulu("blackwater  park!"));
});

test("ze Spotify zostaje tylko to, czego MusicBrainz nie ma", () => {
  const sp = [
    { id: "1", title: "Kingdom of Ants", year: "2018", artists: "Krzysztof Herdzin", url: "u1", cover: null, group: "appears_on" as const },
    { id: "2", title: "Descent into Madness (Remastered)", year: "2021", artists: "Vinnie Colaiuta", url: "u2", cover: null, group: "album" as const },
    { id: "3", title: "Kingdom of Ants", year: "2018", artists: "K. Herdzin", url: "u3", cover: null, group: "album" as const },
  ];
  const out = tylkoNoweTytuly(sp, ["Descent into Madness", "Hard Candy"]);
  assert.deepEqual(out.map((a) => a.id), ["1"], "remaster odpada jako znany, duplikat tytułu tylko raz");
});

test("pusta lista znanych tytułów nie wywala filtra", () => {
  const sp = [{ id: "1", title: "X", year: null, artists: "", url: "u", cover: null, group: "album" as const }];
  assert.equal(tylkoNoweTytuly(sp, []).length, 1);
});
