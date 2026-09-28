
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

const PILL = "rounded-full border px-3 py-1 font-mono transition-colors";
const BARWA: Record<"spotify" | "tidal", string> = {
  spotify: "border-spotify/40 text-spotify hover:bg-spotify/10",
  tidal: "border-tidal/40 text-tidal hover:bg-tidal/10",
};
const NAZWA: Record<"spotify" | "tidal", string> = { spotify: "Spotify", tidal: "Tidal" };

function znak(stan: StanLinku): string {
  return stan === true ? "▸" : stan === false ? "⌕" : "·";
}

/** Pojedynczy guzik — do użycia tam, gdzie adres buduje wywołujący (podróż). */
export function SerwisPill({
  serwis,
  href,
  stan,
  title,
  small = false,
}: {
  serwis: "spotify" | "tidal";
  href: string;
  stan?: StanLinku;
  title?: string;
  small?: boolean;
}) {
  /**
   * NOWA KARTA, nie ta sama.
   * Wyjście do serwisu jest odejściem z portalu — człowiek idzie posłuchać
   * i wraca do tego, co czytał. Gdy otwierało się w miejscu, wracanie
   * wymagało „wstecz" i przeładowania strony, na której był. Dlatego zwykły
   * `<a target="_blank">`, a nie nawigacja wewnętrzna: mimo że adres jest
   * nasz (`/go/…`), kończy się przekierowaniem na zewnątrz.
   */
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      title={title}
      className={`${PILL} ${BARWA[serwis]} ${small ? "text-[11px]" : "text-xs"}`}
    >
      {znak(stan)} {NAZWA[serwis]}
    </a>
  );
}

/**
 * Guzik „słuchaj" dla płyty (albo artysty) — wszędzie ten sam.
 *
 * Dla kogoś bez podłączonego Spotify/Tidala: para guzików jak dotąd, przez
 * `/go/serwis`. Dla kogoś z podłączonym kontem: jeden rozwijany guzik z akcją
 * domyślną („Graj w Spotify" / „Otwórz w aplikacji Tidal") — patrz sluchaj.tsx.
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
