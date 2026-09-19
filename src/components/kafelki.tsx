import Link from "next/link";
import { Cover } from "./cover";
import { SerwisyPills } from "./serwisy";

export interface Kafelek {
  key: string;
  href: string;
  /** gotowy adres okładki (Spotify) — ma pierwszeństwo, bo nie wymaga pytania */
  cover?: string | null;
  /** MBID płyty — okładka z Cover Art Archive, gdy nie ma gotowego adresu */
  mbid?: string | null;
  title: string;
  subtitle?: string | null;
  /** jedno słowo z boku: gatunek, data, cokolwiek — trzeci wiersz, przygaszony */
  meta?: string | null;
  /**
   * „Artysta – Tytuł" — gdy jest, pod kafelkiem pojawiają się przyciski
   * wyjścia w Spotify i Tidala. Półka bez nich wymaga dwóch kliknięć na to,
   * po co człowiek tu przyszedł: żeby tego posłuchać.
   */
  etykieta?: string | null;
}

/**
 * Kafelki z okładkami — jeden sposób pokazywania płyt na stronie głównej.
 *
 * DLACZEGO TAK: strona główna była ścianą tekstu — każda premiera z opisem,
 * recenzjami i przyciskami. Człowiek przyzwyczajony do Spotify czy Tidala
 * skanuje okładki, nie akapity: rozpoznaje płytę po obrazku w ćwierć sekundy,
 * a opis czyta dopiero, gdy już go coś zatrzymało. Więc na wejściu: okładka,
 * tytuł, wykonawca — i tyle. Szczegóły są na stronie płyty, jedno kliknięcie
 * dalej.
 *
 * Stała szerokość kafelka, nie kolumny siatki: przy sześciu kolumnach jeden
 * kafelek rozpychał się na pół ekranu, gdy pozycja była jedna. Tu kafelek ma
 * swój rozmiar niezależnie od tego, ile ich jest.
 *
 * PÓŁKA, NIE SIATKA: jeden rząd, który przewija się w bok. Tak wyglądają
 * wszystkie serwisy, z których ludzie tu przychodzą, i to jest zaleta
 * praktyczna, nie estetyczna — sekcja zajmuje zawsze tyle samo wysokości,
 * więc na stronie głównej mieści się ich kilka naraz i widać, że jest co
 * przewijać w dół. Siatka rosła w dół i spychała wszystko poza ekran.
 */
export function Kafelki({ items }: { items: Kafelek[] }) {
  if (!items.length) return null;
  return (
    <ul className="polka mt-4 flex snap-x gap-4 overflow-x-auto pb-2">
      {items.map((k) => (
        <li key={k.key} className="w-[150px] shrink-0 snap-start">
          <Link href={k.href} className="group block">
            {k.cover ? (
              <div className="h-[150px] w-[150px] overflow-hidden rounded bg-surface2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={k.cover} alt="" loading="lazy" className="h-full w-full object-cover" />
              </div>
            ) : k.mbid ? (
              <Cover mbid={k.mbid} size={150} />
            ) : (
              // Brak okładki: znak portalu na płaskim tle. Zdjęcie winyla
              // powtórzone w pięciu kafelkach z rzędu wyglądało jak treść,
              // a jest tylko zapchajdziurą.
              <div className="flex h-[150px] w-[150px] items-center justify-center rounded bg-surface2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/img/pns/logo.webp" alt="" className="w-1/2 opacity-20" />
              </div>
            )}
            <div className="mt-2 truncate text-sm group-hover:text-accent2" title={k.title}>{k.title}</div>
            {k.subtitle && <div className="truncate text-xs text-muted" title={k.subtitle}>{k.subtitle}</div>}
            {k.meta && <div className="truncate font-mono text-[10px] text-faint">{k.meta}</div>}
          </Link>
          {/* Poza <Link>, bo odnośnik w odnośniku to niepoprawny HTML —
              przeglądarka rozrywa taki kafelek na kawałki. */}
          {k.etykieta && <SerwisyPills etykieta={k.etykieta} mbid={k.mbid} small className="mt-1.5" />}
        </li>
      ))}
    </ul>
  );
}
