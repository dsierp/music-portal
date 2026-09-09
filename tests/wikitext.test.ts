import test from "node:test";
import assert from "node:assert/strict";
import { parseInfoboxMembers } from "../src/lib/wikitext.ts";

test("infoboks: skład zespołu, obecni i dawni", () => {
  const wt = `{{Infobox musical artist
| name = Mgła
| origin = [[Kraków]], Polska
| current_members = * M. – wokal, gitara
* Darkside – perkusja
| past_members = Daren – perkusja
}}
Mgła – polski zespół blackmetalowy.`;
  const out = parseInfoboxMembers(wt);
  assert.deepEqual(out.current.map((p) => p.name), ["M.", "Darkside"]);
  assert.equal(out.current[0].roles, "wokal, gitara");
  assert.deepEqual(out.past.map((p) => p.name), ["Daren"]);
});

test("infoboks: wariant z <br />, linkami i przypisami", () => {
  const wt = `{{Infobox zespół muzyczny
| muzycy = [[Mikołaj Żentara|M.]] – wokal<ref name=a/><br />'''Darkside''' – perkusja
}}`;
  const out = parseInfoboxMembers(wt);
  assert.deepEqual(out.current.map((p) => p.name), ["M.", "Darkside"]);
});

test("infoboks: brak infoboksu albo brak pól ze składem", () => {
  assert.deepEqual(parseInfoboxMembers("Zwykły tekst bez szablonu"), { current: [], past: [] });
  assert.deepEqual(parseInfoboxMembers("{{Infobox musical artist\n| name = X\n}}"), { current: [], past: [] });
});
