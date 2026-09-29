
/**
 * JEDEN przycisk „posłuchaj" na cały portal — Spotify i Tidal.
 *
 * Powód, dla którego to jest osobny plik, a nie trzy kopie w trzech miejscach:
 * ten sam gest wyglądał i DZIAŁAŁ inaczej zależnie od ekranu. Na premierach
 * obwiedziony guzik prowadzący przez naszą trasę, na stronie płyty linijka
 * tekstu, w podróży coś trzeciego, a gdzieniegdzie goły adres wyszukiwarki
 * serwisu — ten ostatni nie zapisywał nawet, że człowiek stąd wyszedł, więc
 * dziennik odsłuchów miał dziury. To samo ma znaczyć to samo i robić to samo.
 *
 * CO ROBI TRASA (`/go/serwis`, a w podróży `/go/stop`): adres płyty ustala
 * DOPIERO przy kliknięciu — najpierw MusicBrainz, potem katalog serwisu po
 * nazwie, a wyszukiwarka jest ostatnią deską ratunku. Przy okazji zapisuje
 * wyjście w dzienniku („puszczone z portalu"), a w podróży stawia ptaszek.
 * Dlatego NIGDY nie budujemy tu adresu serwisu wprost.
 *
 * ZNAK PRZED NAZWĄ niesie treść i dlatego został: strzałka „wchodzisz prosto
 * w płytę", lupka „to będzie szukanie", kropka „jeszcze nie sprawdzaliśmy".
 */
import { Sluchaj } from "./sluchaj";

export type StanLinku = boolean | undefined;

/**
 * Guzik „słuchaj" dla płyty (albo artysty) — wszędzie ten sam.
 *
 * Jeden rozwijany guzik z akcją domyślną dla każdego — patrz sluchaj.tsx.
 * W podróży ten sam komponent, z parametrem `przystanek`.
 * Podpowiedzi liczymy tutaj, bo do komponentu klienckiego funkcji podać nie można.
 */
export function SerwisyPills({
  etykieta,
  mbid,
  typ = "release-group",
  stanSpotify,
  stanTidal,
  tytul,
  small = false,
  className = "",
}: {
  /** „Artysta – Tytuł" (albo sama nazwa artysty przy typ=artist) */
  etykieta: string;
  /** MBID, gdy znany — wtedy trasa pyta najpierw MusicBrainz */
  mbid?: string | null;
  typ?: "release-group" | "artist";
  /** co już wiemy o tym, czy link prowadzi prosto w płytę (z poprzednich kliknięć) */
  stanSpotify?: StanLinku;
  stanTidal?: StanLinku;
  /** podpowiedzi pod kursorem, osobne dla każdego stanu (z tłumaczeń) */
  tytul?: (serwis: "spotify" | "tidal", stan: StanLinku) => string;
  small?: boolean;
  className?: string;
}) {
  return (
    <Sluchaj
      etykieta={etykieta}
      mbid={mbid}
      typ={typ}
      stanSpotify={stanSpotify}
      stanTidal={stanTidal}
      tytulSpotify={tytul?.("spotify", stanSpotify)}
      tytulTidal={tytul?.("tidal", stanTidal)}
      small={small}
      className={className}
    />
  );
}
