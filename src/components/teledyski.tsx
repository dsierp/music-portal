import type { Teledysk } from "@/lib/teledyski";
import { szukajwYt } from "@/lib/teledyski";

/**
 * Lista teledysków — tytuł, rok i wyjście w YouTube.
 *
 * Świadomie BEZ osadzonych ramek: dziesięć odtwarzaczy na stronie to dziesięć
 * połączeń do Google'a przy każdym wejściu, a człowiek i tak obejrzy jeden.
 * Ramka z wyszukiwarką (ta pod spodem, zwijana) zostaje na „pokaż mi coś",
 * a to jest lista do wybrania.
 *
 * Gdy MusicBrainz zna odnośnik do klipu — idziemy prosto w niego. Gdy nie zna,
 * dajemy wyszukanie „zespół tytuł official video", czyli dokładnie to, co
 * człowiek wpisałby sam; podpisujemy to kropkowanym podkreśleniem, żeby było
 * widać, że to szukanie, a nie pewny strzał.
 */
export function Teledyski({
  items,
  artysta,
  t,
}: {
  items: Teledysk[];
  artysta: string;
  t: { title: string; search: string };
}) {
  if (!items.length) return null;
  return (
    <section className="mt-8">
      <h2 className="text-3xl">{t.title}</h2>
      <ul className="mt-3 space-y-1.5 text-sm">
        {items.map((v) => (
          <li key={v.mbid} className="flex flex-wrap items-baseline gap-x-2">
            <a
              href={v.url ?? szukajwYt(artysta, v.title)}
              target="_blank"
              rel="noopener"
              className={`hover:text-accent2 ${v.url ? "" : "underline decoration-dotted"}`}
              title={v.url ? undefined : t.search}
            >
              {v.title}
            </a>
            {v.rok && <span className="font-mono text-[10px] text-faint">{v.rok}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
