/**
 * Nazwy kategorii muzycznych.
 *
 * Większość to nazwy własne gatunków („death metal", „hard bop") i tych nie
 * tłumaczymy — po hiszpańsku też mówi się death metal. Przekładamy tylko te
 * etykiety, w których siedzi polskie słowo („Inne metal", „Klasyka"), oraz
 * nagłówki grup w profilu.
 */
import type { Locale } from "@/lib/i18n";

const pl = {
  death: "Death metal",
  black: "Black metal",
  other: "Inne metal / ciężkie brzmienia",
  otherLong: "Inne metal — doom / sludge / thrash / heavy / avant",
  prog: "Prog rock / prog metal",
  jazz: "Jazz",
  punk: "Punk / hardcore",
  country: "Country / americana",
  classical: "Klasyka",
  electronic: "Elektronika",
  hiphop: "Hip-hop",
  pop: "Pop",
  folk: "Folk / autorska piosenka",
  db: "Death i black metal",
  groupOtherMetal: "Inne metal",
  groupBeyond: "Poza",
};
type T = typeof pl;

const en: T = {
  death: "Death metal",
  black: "Black metal",
  other: "Other metal / heavy sounds",
  otherLong: "Other metal — doom / sludge / thrash / heavy / avant",
  prog: "Prog rock / prog metal",
  jazz: "Jazz",
  punk: "Punk / hardcore",
  country: "Country / americana",
  classical: "Classical",
  electronic: "Electronic",
  hiphop: "Hip-hop",
  pop: "Pop",
  folk: "Folk / singer-songwriter",
  db: "Death and black metal",
  groupOtherMetal: "Other metal",
  groupBeyond: "Beyond",
};

const es: T = {
  death: "Death metal",
  black: "Black metal",
  other: "Otro metal / sonidos pesados",
  otherLong: "Otro metal — doom / sludge / thrash / heavy / avant",
  prog: "Prog rock / prog metal",
  jazz: "Jazz",
  punk: "Punk / hardcore",
  country: "Country / americana",
  classical: "Clásica",
  electronic: "Electrónica",
  hiphop: "Hip-hop",
  pop: "Pop",
  folk: "Folk / cantautor",
  db: "Death y black metal",
  groupOtherMetal: "Otro metal",
  groupBeyond: "Más allá",
};

const de: T = {
  death: "Death Metal",
  black: "Black Metal",
  other: "Anderer Metal / schwere Klänge",
  otherLong: "Anderer Metal — Doom / Sludge / Thrash / Heavy / Avant",
  prog: "Prog Rock / Prog Metal",
  jazz: "Jazz",
  punk: "Punk / Hardcore",
  country: "Country / Americana",
  classical: "Klassik",
  electronic: "Elektronik",
  hiphop: "Hip-Hop",
  pop: "Pop",
  folk: "Folk / Singer-Songwriter",
  db: "Death und Black Metal",
  groupOtherMetal: "Anderer Metal",
  groupBeyond: "Darüber hinaus",
};

export const genres: Record<Locale, T> = { pl, en, es, de };
