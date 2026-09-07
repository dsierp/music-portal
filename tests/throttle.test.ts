import { test } from "node:test";
import assert from "node:assert/strict";
import { createThrottle } from "../src/lib/throttle";

/** Udaje zapytanie sieciowe trwające `ms`. */
const slowCall = (ms: number) => () => new Promise<number>((r) => setTimeout(() => r(Date.now()), ms));

test("kolejka odmierza odstęp między WYSŁANIAMI, nie między odpowiedziami", async () => {
  const gap = 100;
  const throttle = createThrottle(gap);
  const t0 = Date.now();
  // pięć zapytań, każde odpowiada po 150 ms — dłużej niż odstęp
  await Promise.all([1, 2, 3, 4, 5].map(() => throttle(slowCall(150))));
  const total = Date.now() - t0;

  // Poprawnie: 4 odstępy (400 ms) + ostatnia odpowiedź (150 ms) ≈ 550 ms.
  // Stara wersja czekała na każdą odpowiedź: 5 × (100 + 150) ≈ 1250 ms.
  assert.ok(total < 900, `powinno zająć ~550 ms, zajęło ${total} ms`);
  assert.ok(total >= 4 * gap, `nie wolno łamać limitu: ${total} ms`);
});

test("odstęp jest naprawdę zachowany — zapytania nie ruszają razem", async () => {
  const gap = 80;
  const throttle = createThrottle(gap);
  const starts: number[] = [];
  await Promise.all(
    [1, 2, 3, 4].map(() =>
      throttle(async () => {
        starts.push(Date.now());
        await new Promise((r) => setTimeout(r, 120));
      }),
    ),
  );
  starts.sort((a, b) => a - b);
  for (let i = 1; i < starts.length; i++) {
    const d = starts[i] - starts[i - 1];
    assert.ok(d >= gap - 15, `odstęp ${i}: ${d} ms, oczekiwano ≥ ${gap} ms`);
  }
});

test("błąd jednego zapytania nie zatrzymuje kolejki", async () => {
  const throttle = createThrottle(30);
  await assert.rejects(throttle(async () => { throw new Error("bum"); }));
  assert.equal(await throttle(async () => "ok"), "ok");
});
