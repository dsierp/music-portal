import Link from "next/link";
import { Cover } from "./cover";

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
 */
export function Kafelki({ items }: { items: Kafelek[] }) {
  if (!items.length) return null;
  return (
    <ul className="mt-4 flex flex-wrap gap-4">
      {items.map((k) => (
        <li key={k.key} className="w-[124px]">
          <Link href={k.href} className="group block">
            {k.cover ? (
              <div className="h-[124px] w-[124px] overflow-hidden rounded bg-surface2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={k.cover} alt="" loading="lazy" className="h-full w-full object-cover" />
              </div>
            ) : k.mbid ? (
              <Cover mbid={k.mbid} size={124} />
            ) : (
              <div
                className="h-[124px] w-[124px] rounded bg-cover bg-center"
                style={{ backgroundImage: "linear-gradient(rgba(0,0,0,.65),rgba(0,0,0,.65)), url(/img/winyl.jpg)" }}
              />
            )}
            <div className="mt-1 truncate text-xs group-hover:text-accent2" title={k.title}>{k.title}</div>
            {k.subtitle && <div className="truncate text-[11px] text-muted" title={k.subtitle}>{k.subtitle}</div>}
            {k.meta && <div className="truncate font-mono text-[10px] text-faint">{k.meta}</div>}
          </Link>
        </li>
      ))}
    </ul>
  );
}
