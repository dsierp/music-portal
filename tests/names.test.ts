import { test } from "node:test";
import assert from "node:assert/strict";
import { nameKeys, normalizeName } from "../src/lib/names";
import { splitPersonnelLine } from "../src/lib/wikitext";

test("rozbicie linii składu z Wikipedii na nazwisko i role", () => {
  assert.deepEqual(splitPersonnelLine("Paul Masvidal – wokal prowadzący, gitara elektryczna"), {
    name: "Paul Masvidal",
    roles: "wokal prowadzący, gitara elektryczna",
  });
  // myślnik bez spacji jest częścią nazwiska, nie separatorem
  assert.deepEqual(splitPersonnelLine("Jean-Luc Ponty – skrzypce"), { name: "Jean-Luc Ponty", roles: "skrzypce" });
  // całe zdanie to nie nazwisko
  assert.equal(splitPersonnelLine("Album nagrano w Broken Wave Studios w Los Angeles w 2008"), null);
});

test("dopasowanie nazwisk mimo drugiego imienia i diakrytyków", () => {
  // klucz skrócony pozwala spiąć "Sean Patrick Reinert" (Wikipedia) z "Sean Reinert" (MusicBrainz)
  const mb = new Map<string, string>();
  for (const k of nameKeys("Sean Reinert")) mb.set(k, "MBID-REINERT");
  const found = nameKeys("Sean Patrick Reinert").map((k) => mb.get(k)).find(Boolean);
  assert.equal(found, "MBID-REINERT");

  assert.equal(normalizeName("Michał Łoś"), "michal los");
});
