import { avatarImage, genreImage } from "./genre-art";
import { genreToSection } from "./genres";

/**
 * Styl wiodący użytkownika i oprawa graficzna, która z niego wynika.
 *
 * TY OKREŚLASZ, CO LUBISZ — PORTAL DOBIERA GRAFIKI. Tło nagłówków bierze się
 * ze stylu z NAJWYŻSZĄ wagą w profilu: ustaw „modern jazz" na 5, a portal wita
 * Cię saksofonem; ustaw „death metal", a dostajesz demona z Pure New Shit.
 *
 * Grafiki PNS (demon, czaszki) pasują do kogoś, kto słucha metalu — dla
 * jazzmana czy słuchacza klasyki byłyby nie na miejscu, więc trafiają wyłącznie
 * do stylów death/black i pokrewnych ciężkich.
 *
 * Bez zalogowania albo bez ustawionych stylów: pop — neutralny ton, który
 * nikogo nie zaskakuje, dopóki nie powie, czego słucha.
 */
export interface UserGenre {
  genre: string;
  weight: number;
}

/** Styl z najwyższą wagą; przy remisie pierwszy z listy. null = brak preferencji. */
export function leadStyle(genres: UserGenre[]): UserGenre | null {
  let best: UserGenre | null = null;
  for (const g of genres) if (!best || g.weight > best.weight) best = g;
  return best;
}

export interface HeroArt {
  /** tło nagłówka */
  bg: string;
  /** postać na pierwszym planie (tylko oprawa PNS) */
  ghoul: string | null;
  /** czy to domyślna oprawa PNS (metal) */
  pns: boolean;
}

const PNS: HeroArt = { bg: "/img/pns/masthead-bg.jpg", ghoul: "/img/pns/ghoul.webp", pns: true };
/** Domyślna oprawa, gdy nie wiadomo, czego ktoś słucha. */
const DEFAULT_ART: HeroArt = { bg: "/img/genres/pop.jpg", ghoul: null, pns: false };

/**
 * Oprawa dla stylu wiodącego. Metal (i brak preferencji) → oryginalna oprawa
 * PNS. Reszta → grafika gatunku z public/img/genres, z zejściem do szerszej
 * nazwy (np. „spiritual jazz" → „jazz").
 */
export function heroArt(lead: UserGenre | null): HeroArt {
  if (!lead) return DEFAULT_ART;
  const section = genreToSection(lead.genre);
  const figure = ghoulFor(lead.genre, section);
  if (section === "db" || section === "other") return { ...PNS, ghoul: figure ?? PNS.ghoul };
  const img = genreImage(lead.genre, section ?? "", "pop");
  if (!img) return figure ? { ...DEFAULT_ART, ghoul: figure } : DEFAULT_ART;
  return { bg: img, ghoul: figure, pns: false };
}

/**
 * Postać dla stylu wiodącego. Nazwa pliku = slug kategorii (punk.svg,
 * country.svg…), a death i black schodzą do wspólnego metal.svg — to jeden
 * i ten sam demon, nie ma sensu trzymać go dwa razy.
 */
function ghoulFor(genre: string, section: ReturnType<typeof genreToSection>): string | null {
  const wider = section === "db" ? "metal" : section === "other" ? "metal" : (section ?? "");
  return avatarImage(genre, wider);
}

/**
 * Tło nagłówka sekcji premier — grafika gatunku sekcji (metal dostaje oprawę PNS).
 *
 * Do 11.09.2026 wszystko, co nie było metalem ani progiem, dostawało tło
 * jazzowe — bo innych gatunków w premierach po prostu nie było. Odkąd artefakt
 * przysyła blok „poza kanonem", klasyka z saksofonem w tle wyglądałaby głupio,
 * więc każdy kod szuka własnej grafiki w public/img/genres.
 */
const HERO_NAMES: Record<string, string[]> = {
  prog: ["prog", "progressive rock"],
  jazz: ["jazz", "modern jazz"],
  punk: ["punk", "punk-hardcore"],
  electronic: ["electronic"],
  folk: ["folk", "singer-songwriter"],
  country: ["country", "country-americana"],
  classical: ["classical", "klasyka"],
  hiphop: ["hip-hop", "hip hop"],
  pop: ["pop"],
};

export function sectionHeroArt(genre: string): string {
  if (genre === "db" || genre === "death") return "/img/pns/friday-red.jpg";
  if (genre === "black" || genre === "other") return "/img/pns/friday-morgue.jpg";
  const [first, ...rest] = HERO_NAMES[genre] ?? [genre];
  return genreImage(first, ...rest) ?? "/img/pns/friday-morgue.jpg";
}
