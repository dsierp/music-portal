"use client";

/**
 * Filtry premier — odklikiwane NA MIEJSCU, bez chodzenia do serwera.
 *
 * Skąd się wzięło: chipy gatunków były zwykłymi linkami z `?g=…`. Każdy klik
 * to było pełne przeładowanie strony `/premiery` (a ta jest `force-dynamic`,
 * więc i ponowne pytanie do bazy) — po kilkaset milisekund, czasem więcej,
 * za odznaczenie jednej kategorii. W samym zestawieniu „Pure New Shit" to
 * jeden `classList.toggle` i dzieje się natychmiast; nie ma powodu, żeby
 * u nas było wolniej.
 *
 * Serwer renderuje WSZYSTKIE karty raz, a ten komponent tylko decyduje, które
 * pokazać. Karty przychodzą gotowe (jako `node`), więc klient nie dostaje ani
 * danych płyt, ani logiki — tylko kawałki HTML do poukładania.
 */
import { useMemo, useState, type ReactNode } from "react";
import { SectionHead } from "./masthead";
import { KategorieFiltru } from "./filter-list";

export interface PozycjaFiltru {
  id: string;
  sectionId: string;
  /** kategoria po rozbiciu „db" na death/black */
  g: string;
  /** 1 = wyróżnione, 0 = zwykłe, -1 = wiersz zbiorczy */
  star: number;
  /** reedycja / EP / live / kompilacja */
  flagged: boolean;
  node: ReactNode;
}

export interface SekcjaFiltru {
  id: string;
  title: string;
  date: string | null;
  sub: string | null;
  /** id pozycji tygodnia (pełne, z prefiksem sekcji) */
  pickId: string | null;
  pickNode: ReactNode;
  /** czy pod sekcją pokazać przycisk „zrób z tego podróż" */
  podroz: boolean;
  podrozTytul: string;
}

export interface TekstyFiltru {
  genresLabel: string;
  viewLabel: string;
  starOnly: string;
  showFlagged: string;
  footnote: string;
  noMatch: string;
  journey: string;
  journeyNote: string;
  all: string;
  none: string;
  mine: string;
  jump: string;
}

export function ReleaseFilters({
  cats,
  catLabels,
  domyslne,
  sections,
  items,
  heroArt,
  groupImage,
  teksty,
  akcjaPodrozy,
}: {
  /** kategorie do pokazania jako chipy, w gotowej kolejności */
  cats: string[];
  catLabels: Record<string, string>;
  /** kategorie z profilu — zaznaczone na starcie */
  domyslne: string[];
  sections: SekcjaFiltru[];
  items: PozycjaFiltru[];
  /** gatunek → tło nagłówka sekcji */
  heroArt: Record<string, string>;
  /** gatunek → grafika paska z nazwą kategorii */
  groupImage: Record<string, string | null>;
  teksty: TekstyFiltru;
  /** akcja serwerowa — podróż zapisuje to, co AKTUALNIE widać na ekranie */
  akcjaPodrozy: (formData: FormData) => void | Promise<void>;
}) {
  // Na starcie zaznaczone są TWOJE style z profilu. Dotąd widać było wszystko,
  // a preferencje wpływały tylko na kolejność — czyli ktoś, kto powiedział
  // portalowi, czego słucha, i tak dostawał pełną listę do ręcznego zawężania.
  const [wybrane, setWybrane] = useState<Set<string>>(() => new Set(domyslne.length ? domyslne : cats));
  const [tylkoGwiazdki, setTylkoGwiazdki] = useState(false);
  const [zReedycjami, setZReedycjami] = useState(false);

  const liczniki = useMemo(() => {
    const m: Record<string, number> = {};
    for (const i of items) m[i.g] = (m[i.g] ?? 0) + 1;
    return m;
  }, [items]);

  const widoczne = useMemo(
    () =>
      items.filter((i) => {
        if (!wybrane.has(i.g)) return false;
        if (tylkoGwiazdki && i.star !== 1) return false;
        if (!zReedycjami && i.flagged) return false;
        return true;
      }),
    [items, wybrane, tylkoGwiazdki, zReedycjami],
  );

  return (
    <div className="mt-8 grid gap-8 md:grid-cols-[240px_1fr]">
      <aside className="md:sticky md:top-20 md:self-start">
        <KategorieFiltru
          cats={cats}
          catLabels={catLabels}
          liczniki={liczniki}
          wybrane={wybrane}
          setWybrane={setWybrane}
          domyslne={domyslne}
          label={teksty.genresLabel}
          teksty={teksty}
        />
        <div className="label mt-5 mb-2">{teksty.viewLabel}</div>
        <div className="flex flex-col gap-1.5 text-sm">
          <button type="button" aria-pressed={tylkoGwiazdki} onClick={() => setTylkoGwiazdki((v) => !v)} className={`chip w-full justify-between ${tylkoGwiazdki ? "chip-on" : ""}`}>
            {teksty.starOnly}
          </button>
          <button type="button" aria-pressed={zReedycjami} onClick={() => setZReedycjami((v) => !v)} className={`chip w-full justify-between ${zReedycjami ? "chip-on" : ""}`}>
            {teksty.showFlagged}
          </button>
        </div>
        <p className="mt-5 text-xs text-faint">{teksty.footnote}</p>
      </aside>
      <div>
        {sections.map((s) => {
          const moje = widoczne.filter((i) => i.sectionId === s.id);
          const grupy = cats
            .filter((g) => moje.some((i) => i.g === g))
            .map((g) => ({ g, items: moje.filter((i) => i.g === g) }));
          // Tło nagłówka bierzemy z gatunku, który po odfiltrowaniu został
          // w sekcji na pierwszym miejscu — tak jak przed przejściem na klienta.
          const lead = grupy[0]?.g ?? "db";
          const pickWidoczny = s.pickId ? moje.some((i) => i.id === s.pickId) : false;
          return (
            <div key={s.id}>
              <section className="mb-12">
                <SectionHead
                  image={heroArt[lead] ?? heroArt.db ?? ""}
                  title={s.title}
                  date={s.date}
                  note={s.sub}
                  count={moje.length}
                  variant={lead === "db" || lead === "death" ? "red" : lead === "black" || lead === "other" ? "morgue" : "other"}
                />
                {pickWidoczny && s.pickNode}
                {grupy.map(({ g, items: wiersze }) => (
                  <div key={g} data-kat={g} className="mt-6 scroll-mt-24">
                    <h3 className="label relative mb-3 overflow-hidden rounded border border-rule px-3 py-2 text-xs">
                      {groupImage[g] && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={groupImage[g]!} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-25" />
                      )}
                      <span className="absolute inset-0 bg-gradient-to-r from-bg via-bg/80 to-transparent" />
                      <span className="relative">{catLabels[g] ?? g}</span>
                    </h3>
                    <ul className="space-y-3">{wiersze.map((i) => i.node)}</ul>
                  </div>
                ))}
                {!grupy.length && !pickWidoczny && <p className="mt-3 text-sm text-muted">{teksty.noMatch}</p>}
              </section>
              {s.podroz && (
                /* Podróż z tego, co i tak jest na ekranie — jeden klik zamiast
                   dwudziestu „dodaj do podróży". Filtr jedzie razem z formularzem,
                   bo podróż ma być zapisem widoku, a nie osobnym wyborem portalu. */
                <form action={akcjaPodrozy} className="mb-8 mt-2">
                  <input type="hidden" name="sectionId" value={s.id} />
                  <input type="hidden" name="title" value={s.podrozTytul} />
                  <input type="hidden" name="genres" value={[...wybrane].join(",")} />
                  <input type="hidden" name="star" value={tylkoGwiazdki ? "1" : "0"} />
                  <input type="hidden" name="re" value={zReedycjami ? "1" : "0"} />
                  <button className="btn btn-accent">{teksty.journey}</button>
                  <span className="ml-2 text-[10px] text-faint">{teksty.journeyNote}</span>
                </form>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
