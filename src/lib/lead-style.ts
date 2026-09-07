import { genreImage } from "./genre-art";
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
  if (section === "db" || section === "other") return PNS;
  const img = genreImage(lead.genre, section ?? "", "pop");
  return img ? { bg: img, ghoul: null, pns: false } : DEFAULT_ART;
}

/** Tło nagłówka sekcji premier — grafika gatunku sekcji (metal dostaje oprawę PNS). */
export function sectionHeroArt(genre: string): string {
  if (genre === "db") return "/img/pns/friday-red.jpg";
  if (genre === "other") return "/img/pns/friday-morgue.jpg";
  return genreImage(genre === "prog" ? "prog" : "jazz") ?? "/img/pns/friday-morgue.jpg";
}
