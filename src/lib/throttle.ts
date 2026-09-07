/**
 * Kolejka pilnująca limitu MusicBrainz (1 zapytanie na sekundę).
 *
 * Rzecz, na której łatwo stracić połowę prędkości: limit dotyczy odstępu między
 * WYSŁANIAMI, a nie między zakończeniami. Pierwsza wersja tej kolejki czekała
 * na odpowiedź poprzedniego zapytania i dopiero potem odliczała sekundę — przy
 * odpowiedziach po 700 ms dawało to 1,8 s na zapytanie zamiast 1,1 s, czyli
 * dwa razy dłuższe pobieranie przy tym samym obciążeniu MusicBrainz.
 *
 * Teraz kolejka rezerwuje tylko MOMENT WYSŁANIA. Zapytania nadal ruszają jedno
 * po drugim w odstępie MIN_GAP_MS, ale odpowiedzi mogą wracać równolegle —
 * limit jest respektowany co do joty, a czekanie znika.
 */
export function createThrottle(minGapMs: number) {
  let chain: Promise<void> = Promise.resolve();
  let lastStart = 0;

  return function throttle<T>(fn: () => Promise<T>): Promise<T> {
    const slot = chain.then(async () => {
      const wait = Math.max(0, lastStart + minGapMs - Date.now());
      if (wait) await new Promise((r) => setTimeout(r, wait));
      lastStart = Date.now();
    });
    // Kolejny czeka wyłącznie na zwolnienie slotu, nie na wynik fn.
    chain = slot;
    return slot.then(fn);
  };
}
