import test from "node:test";
import assert from "node:assert/strict";
import { rozbijEtykiete, kluczTytulu, tylkoNoweTytuly, zapytanieOAlbum } from "../src/lib/spotify.ts";

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

test("zapytanie do Spotify: wartości w cudzysłowie", () => {
  // Bez cudzysłowu Spotify bierze tylko pierwsze słowo tytułu i nie znajduje nic.
  assert.equal(
    zapytanieOAlbum("Mgła", "Exercises in Futility"),
    'album:"Exercises in Futility" artist:"Mgła"',
  );
  assert.equal(zapytanieOAlbum("", "Kingdom of Ants"), 'album:"Kingdom of Ants"');
  // Cudzysłów w tytule wycinamy, żeby nie rozwalił zapytania.
  assert.equal(zapytanieOAlbum("AC/DC", 'Back in "Black"'), 'album:"Back in Black" artist:"AC/DC"');
});

test("tytuł z katalogu: dokładny, z dopiskiem wydawcy i inna płyta", async () => {
  const { tytulPasuje, najlepszyTytul } = await import("../src/lib/spotify.ts");
  assert.equal(tytulPasuje("Beyond The Sky", "Beyond the Sky"), 2);
  assert.equal(tytulPasuje("Beyond The Sky (Digital Only)", "Beyond the Sky"), 1);
  assert.equal(tytulPasuje("Deadwing - Deluxe", "Deadwing"), 2); // znany dopisek: kluczTytulu tnie go sam
  assert.equal(tytulPasuje("Deadwing (Bonus Tracks)", "Deadwing"), 1);
  assert.equal(tytulPasuje("Blackwater Park [20th Anniversary]", "Blackwater Park"), 1);
  // inna płyta, nie dopisek
  assert.equal(tytulPasuje("Beyond The Sky (Live)", "Beyond the Sky"), 0);
  assert.equal(tytulPasuje("Solaris - Single", "Solaris"), 0);
  assert.equal(tytulPasuje("Leviathan (Demo)", "Leviathan"), 0);
  assert.equal(tytulPasuje("Beyond the Skyline", "Beyond the Sky"), 0);
  // gdy MB sam ma „(Live)", porównanie jest dokładne
  assert.equal(tytulPasuje("Alive (Live)", "Alive (Live)"), 2);
  // dokładny wygrywa z dopiskiem, niezależnie od kolejności
  const lista = [{ t: "Beyond The Sky (Digital Only)" }, { t: "Beyond the Sky" }];
  assert.equal(najlepszyTytul(lista, (x) => x.t, "Beyond the Sky")?.t, "Beyond the Sky");
  assert.equal(najlepszyTytul([lista[0]], (x) => x.t, "Beyond the Sky")?.t, "Beyond The Sky (Digital Only)");
});
