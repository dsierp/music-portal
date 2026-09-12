"use client";

/**
 * Ciche odświeżanie ekranu, który na coś czeka.
 *
 * BYŁ TU `<meta http-equiv="refresh">` i to był błąd. Przeładowywał CAŁĄ
 * stronę co trzy sekundy: obrazki wczytywały się od nowa, ekran mrugał,
 * przewinięcie skakało na górę, a przy odrobinie pecha trafiało się w moment,
 * gdy strona jeszcze się rysuje. Wyglądało jak usterka, bo w praktyce nią było.
 *
 * `router.refresh()` pobiera samą treść serwerową i podmienia to, co się
 * zmieniło. Żadnego mrugania, żadnego skakania, bez ruszania przewinięcia
 * i bez gubienia tego, co człowiek zdążył wpisać w pole.
 *
 * Zatrzymuje się, gdy karta jest w tle — nikt tam nie patrzy, a każde takie
 * odświeżenie to zapytanie do bazy.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function Odswiezaj({ co = 3000 }: { co?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, co);
    return () => clearInterval(id);
  }, [router, co]);
  return null;
}
