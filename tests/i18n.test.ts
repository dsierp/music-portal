import { test } from "node:test";
import assert from "node:assert/strict";
import { LOCALES, formatDate, fromAcceptLanguage, normalizeLocale, plural, fmt, wikiLangs } from "../src/lib/i18n.ts";
import { dict } from "../src/lib/dict/index.ts";

test("kod języka rozpoznajemy też w wariantach regionalnych", () => {
  assert.equal(normalizeLocale("de-AT"), "de");
  assert.equal(normalizeLocale("ES"), "es");
  assert.equal(normalizeLocale(" en_US "), "en");
  assert.equal(normalizeLocale("cs"), null, "czeskiego nie mamy — wolimy null niż udawanie");
  assert.equal(normalizeLocale(""), null, "pusty ciąg to nie wybór (klasyczna pułapka ?? vs ||)");
});

test("Accept-Language: decyduje waga, nie kolejność zapisu", () => {
  assert.equal(fromAcceptLanguage("cs,sk;q=0.9,de;q=0.8"), "de", "pierwszy OBSŁUGIWANY, nie pierwszy z brzegu");
  assert.equal(fromAcceptLanguage("en;q=0.5,es;q=0.9"), "es");
  assert.equal(fromAcceptLanguage("ja,ko"), null);
  assert.equal(fromAcceptLanguage(null), null);
});

test("daty czyta się po ludzku w każdym języku", () => {
  assert.match(formatDate("2026-10-04", "pl", { year: false }), /października/);
  assert.match(formatDate("2026-10-04", "en", { year: false }), /October/);
  assert.match(formatDate("2026-10-04", "es", { year: false }), /octubre/);
  assert.match(formatDate("2026-10-04", "de", { year: false }), /Oktober/);
  assert.equal(formatDate("bez-daty", "pl"), "bez-daty", "śmieci przepuszczamy bez zmian");
});

test("liczba mnoga: polski ma trzy formy, angielski dwie", () => {
  const pl = { one: "{n} płyta", few: "{n} płyty", many: "{n} płyt" };
  assert.equal(plural("pl", 1, pl), "1 płyta");
  assert.equal(plural("pl", 3, pl), "3 płyty");
  assert.equal(plural("pl", 7, pl), "7 płyt");
  const en = { one: "{n} album", many: "{n} albums" };
  assert.equal(plural("en", 1, en), "1 album");
  assert.equal(plural("en", 5, en), "5 albums");
});

test("fmt podstawia tylko to, co dostał", () => {
  assert.equal(fmt("Znalazłam {n} koncertów w {city}", { n: 3, city: "Kraków" }), "Znalazłam 3 koncertów w Kraków");
  assert.equal(fmt("brak {x}", {}), "brak {x}", "nieznany placeholder zostaje — łatwiej zauważyć dziurę");
});

test("Wikipedia próbuje najpierw języka czytelnika, potem en i pl", () => {
  assert.deepEqual(wikiLangs("es"), ["es", "en", "pl"]);
  assert.deepEqual(wikiLangs("pl"), ["pl", "en"], "bez powtórek");
  assert.deepEqual(wikiLangs("en"), ["en", "pl"]);
});

test("każdy język ma komplet napisów — żadnej dziury ani zaślepki", () => {
  const pl = dict("pl");
  for (const locale of LOCALES) {
    const d = dict(locale);
    for (const [ns, values] of Object.entries(pl)) {
      const mine = (d as Record<string, Record<string, unknown>>)[ns];
      assert.ok(mine, `brak działu ${ns} w ${locale}`);
      for (const key of Object.keys(values as Record<string, unknown>)) {
        const v = mine[key];
        assert.ok(v !== undefined && v !== null, `brak klucza ${ns}.${key} w ${locale}`);
        if (typeof v === "string") {
          assert.notEqual(v.trim(), "", `pusty napis ${ns}.${key} w ${locale}`);
        }
      }
      assert.ok(!("todo" in (mine as object)), `została zaślepka w ${ns} (${locale})`);
    }
  }
});
