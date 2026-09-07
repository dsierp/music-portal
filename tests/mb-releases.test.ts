import { test } from "node:test";
import assert from "node:assert/strict";
import { weekOf, releaseQuery } from "../src/lib/week";

test("okno tygodnia liczone od piątku", () => {
  // wtorek 08.09.2026 → tydzień zaczyna się w piątek 04.09
  const w = weekOf(new Date("2026-09-08T12:00:00Z"));
  assert.equal(w.friday, "2026-09-04");
  assert.equal(w.from, "2026-09-04");
  assert.equal(w.to, "2026-09-10");

  // sam piątek należy do swojego tygodnia, nie poprzedniego
  assert.equal(weekOf(new Date("2026-09-04T03:00:00Z")).friday, "2026-09-04");
  // czwartek to jeszcze poprzedni piątek
  assert.equal(weekOf(new Date("2026-09-03T23:00:00Z")).friday, "2026-08-28");
});

test("zapytanie do MusicBrainz: tag + zakres dat + typ", () => {
  const w = weekOf(new Date("2026-09-08T12:00:00Z"));
  assert.equal(
    releaseQuery("country", w),
    'tag:"country" AND firstreleasedate:[2026-09-04 TO 2026-09-10] AND primarytype:album AND status:official',
  );
  // cudzysłów w nazwie stylu nie może rozwalić zapytania
  assert.ok(!releaseQuery('po"p', w).includes('po"p'));
});
