/**
 * Ogłoszenie serwisowe — jedno miejsce, w którym ustawiamy okienko „Uwaga".
 *
 * Nie ma tu panelu w portalu i nie ma tabeli w bazie, bo nie ma czego
 * administrować: takie ogłoszenie pojawia się kilka razy w roku, zawsze przy
 * okazji wdrożenia, a wdrożenie i tak jest commitem. Dominik mówi, co ma stać
 * w okienku, treść ląduje niżej i wychodzi razem z kodem.
 *
 * Wyłączenie: `wlaczone: false`. Samoczynne wygaśnięcie: po dniu `doDnia`
 * okienko przestaje się pokazywać samo, bez pamiętania o niczym.
 *
 * `wersja` to jedyna sztuczka. Kto kliknął „Rozumiem", ma to zapisane w swojej
 * przeglądarce razem z numerem wersji — więc zmiana treści BEZ podbicia numeru
 * nie dotrze do nikogo, kto już klikał. Zmieniasz treść → podbijasz numer.
 */
import type { Locale } from "@/lib/i18n";

export const SERWIS = {
  wlaczone: true,

  /** Podbij przy każdej zmianie treści — inaczej stali czytelnicy jej nie zobaczą. */
  wersja: 1,

  /** Ostatni dzień pokazywania (włącznie), w strefie czytelnika. Puste = bez końca. */
  doDnia: "2026-10-06",

  komunikat: {
    pl: {
      etykieta: "Uwaga",
      guzik: "Rozumiem",
      tytul: "Portal w przebudowie",
      tresc:
        "Grzebiemy w środku, więc niektóre rzeczy mogą nie działać: premiery, wykresy składów, linki do Spotify i Tidala. Oceny, komentarze i podróże są bezpieczne — nic z nich nie ginie.",
    },
    en: {
      etykieta: "Heads-up",
      guzik: "Got it",
      tytul: "The site is being rebuilt",
      tresc:
        "We're digging around inside, so some things may not work: new releases, lineup charts, Spotify and Tidal links. Your ratings, comments and journeys are safe — none of that is going anywhere.",
    },
    es: {
      etykieta: "Atención",
      guzik: "Entendido",
      tytul: "El portal está en obras",
      tresc:
        "Estamos trabajando por dentro, así que algunas cosas pueden fallar: los estrenos, los gráficos de formaciones, los enlaces a Spotify y Tidal. Tus valoraciones, comentarios y viajes están a salvo: no se pierde nada.",
    },
    de: {
      etykieta: "Achtung",
      guzik: "Verstanden",
      tytul: "Das Portal wird umgebaut",
      tresc:
        "Wir arbeiten im Inneren, deshalb kann manches nicht funktionieren: Neuerscheinungen, Besetzungsverläufe, Links zu Spotify und Tidal. Bewertungen, Kommentare und Reisen sind sicher — davon geht nichts verloren.",
    },
  } satisfies Record<Locale, { etykieta: string; guzik: string; tytul: string; tresc: string }>,
} as const;

/** Klucz w localStorage — z numerem wersji w środku, żeby nowa treść liczyła się od nowa. */
export const kluczSerwisu = `pns:serwis:v${SERWIS.wersja}`;

/**
 * Czy ogłoszenie jest dziś aktualne. Liczymy po dacie czytelnika, nie serwera:
 * okienko ma zniknąć wtedy, kiedy dla niego minął ostatni dzień.
 */
export function serwisAktualny(teraz = new Date()): boolean {
  if (!SERWIS.wlaczone) return false;
  if (!SERWIS.doDnia) return true;
  const dzis = `${teraz.getFullYear()}-${String(teraz.getMonth() + 1).padStart(2, "0")}-${String(teraz.getDate()).padStart(2, "0")}`;
  return dzis <= SERWIS.doDnia;
}
