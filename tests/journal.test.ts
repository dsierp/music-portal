import test from "node:test";
import assert from "node:assert/strict";
import { scalDziennik, poDniach, dzien, type JournalEvent } from "../src/lib/journal.ts";

const zdarzenie = (iso: string, kind: JournalEvent["kind"], title: string): JournalEvent => ({
  at: new Date(iso),
  kind,
  title,
  href: `/x/${title}`,
  context: null,
  contextHref: null,
  sentiment: null,
  score: null,
});

test("dziennik: strumienie scalone i posortowane od najnowszego", () => {
  const out = scalDziennik([
    [zdarzenie("2026-01-02T10:00:00Z", "album", "b")],
    [zdarzenie("2026-01-03T10:00:00Z", "stop", "c"), zdarzenie("2026-01-01T10:00:00Z", "journey", "a")],
  ]);
  assert.deepEqual(out.map((e) => e.title), ["c", "b", "a"]);
});

test("dziennik: limit tnie, ale dopiero po scaleniu", () => {
  const duzo = Array.from({ length: 30 }, (_, i) => zdarzenie(`2026-01-${String(i + 1).padStart(2, "0")}T10:00:00Z`, "album", `p${i}`));
  const out = scalDziennik([duzo], 5);
  assert.equal(out.length, 5);
  assert.equal(out[0].title, "p29", "najnowsze zostaje, nie pierwsze z brzegu");
});

test("dziennik: to samo zdarzenie z dwóch strumieni liczy się raz", () => {
  const e = zdarzenie("2026-02-01T12:00:00Z", "stop", "Bolt Thrower");
  const out = scalDziennik([[e], [{ ...e }]]);
  assert.equal(out.length, 1);
});

test("dziennik: zdarzenia bez sensownej daty odpadają", () => {
  const zle = { ...zdarzenie("2026-01-01T00:00:00Z", "album", "x"), at: new Date("nie-data") };
  const out = scalDziennik([[zle, zdarzenie("2026-01-02T10:00:00Z", "album", "ok")]]);
  assert.deepEqual(out.map((e) => e.title), ["ok"]);
});

test("dziennik: grupowanie po dniach, dni od najnowszego", () => {
  const a = new Date("2026-03-10T09:00:00");
  const b = new Date("2026-03-10T20:00:00");
  const c = new Date("2026-03-09T20:00:00");
  const out = poDniach([
    { ...zdarzenie("2026-01-01T00:00:00Z", "album", "b"), at: b },
    { ...zdarzenie("2026-01-01T00:00:00Z", "album", "a"), at: a },
    { ...zdarzenie("2026-01-01T00:00:00Z", "album", "c"), at: c },
  ]);
  assert.equal(out.length, 2);
  assert.equal(out[0].day, dzien(a));
  assert.equal(out[0].events.length, 2);
  assert.equal(out[1].events.length, 1);
});
