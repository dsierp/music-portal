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
/** Identyfikator filmu z adresu YouTube — do osadzenia odtwarzacza. */
function idFilmu(url: string | null | undefined): string | null {
  if (!url) return null;
  const m =
    url.match(/[?&]v=([\w-]{6,})/) ??
    url.match(/youtu\.be\/([\w-]{6,})/) ??
    url.match(/youtube\.com\/(?:embed|v|shorts)\/([\w-]{6,})/);
  return m?.[1] ?? null;
}

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
  // Pierwszy klip, który znamy z adresu, gra od razu na stronie.
  //
  // Wcześniej był tu osadzony odtwarzacz z „playlistą wyszukiwania" — YouTube
  // tę furtkę zamknął i ramka pokazywała „Ten film jest niedostępny". Ale sam
  // pomysł był dobry: człowiek chce usłyszeć, nie klikać. Więc osadzamy
  // KONKRETNY film, o którym wiemy, że istnieje, a reszta jest listą obok.
  const pierwszy = items.map((v) => idFilmu(v.url)).find(Boolean) ?? null;
  return (
    <section className="mt-8">
      <h2 className="text-3xl">{t.title}</h2>
      {pierwszy && (
        <div className="mt-3 aspect-video w-full overflow-hidden rounded-lg border border-rule bg-surface2">
          <iframe
            className="h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${pierwszy}`}
            title={t.title}
            loading="lazy"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
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
