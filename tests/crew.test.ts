import { test } from "node:test";
import assert from "node:assert/strict";
import { ARTWORK_ROLES, isCrewRole, isMusicianRole } from "../src/lib/musicbrainz.ts";

test("ekipa to producent i okładka, nie gitarzysta", () => {
  for (const r of ["producer", "mix", "mastering", "engineer", "design/illustration", "photography", "liner notes"]) {
    assert.equal(isCrewRole(r), true, `${r} powinno być ekipą`);
  }
  for (const r of ["guitar", "lead vocals", "drums (drum set)"]) {
    assert.equal(isCrewRole(r), false, `${r} to granie`);
    assert.equal(isMusicianRole(r), true);
  }
});

test("papierologia nie zaśmieca listy", () => {
  // Zdanie użytkownika: „ważne kto produkował i kto malował". Firma trzymająca
  // prawa nie jest powodem, dla którego ktoś sięga po płytę.
  for (const r of ["copyright", "phonographic copyright", "publishing", "booking", "legal representation"]) {
    assert.equal(isCrewRole(r), false, `${r} nie powinno trafić na listę`);
  }
});

test("okładki oddzielamy od studia", () => {
  assert.ok(ARTWORK_ROLES.test("design/illustration"));
  assert.ok(ARTWORK_ROLES.test("photography"));
  assert.ok(!ARTWORK_ROLES.test("producer"));
  assert.ok(!ARTWORK_ROLES.test("mastering"));
});
