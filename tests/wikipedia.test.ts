import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRatingsTemplate } from "../src/lib/wikitext";

// Fragment w kształcie prawdziwego artykułu (Traced in Air): gwiazdki jako
// {{Rating}}, oceny wpisane wprost, linki [[…]], mieszana wielkość liter
// w nazwach parametrów (revNScore vs revNscore) i nawias klamrowy zagnieżdżony.
const SAMPLE = `{{Infobox album
| name = Traced in Air
}}
{{Album ratings
| rev1 = [[About.com]]
| rev1Score = {{Rating|4|5}}
| rev2 = [[AllMusic]]
| rev2Score = {{Rating|4.5|5}}
| rev3 = [[Blabbermouth.net]]
| rev3score = 9/10
| rev4 = ''[[Terrorizer (magazine)|Terrorizer]]''
| rev4Score = 9.5/10
| rev5 = [[Sputnikmusic]]
| rev5Score = 5.0/5
}}
'''Traced in Air''' – drugi album…`;

test("oceny prasowe z szablonu Wikipedii", () => {
  const out = parseRatingsTemplate(SAMPLE);
  assert.deepEqual(out, [
    { source: "About.com", score: "4/5" },
    { source: "AllMusic", score: "4.5/5" },
    { source: "Blabbermouth.net", score: "9/10" },
    { source: "Terrorizer", score: "9.5/10" },
    { source: "Sputnikmusic", score: "5.0/5" },
  ]);
});

test("brak szablonu ocen = pusta lista, nie wyjątek", () => {
  assert.deepEqual(parseRatingsTemplate("{{Infobox album|name=X}}\nZwykły tekst."), []);
});

test("ocena bez nazwy źródła (i odwrotnie) jest pomijana", () => {
  const out = parseRatingsTemplate("{{Album ratings|rev1 = [[AllMusic]]|rev2Score = 7/10}}");
  assert.deepEqual(out, []);
});
