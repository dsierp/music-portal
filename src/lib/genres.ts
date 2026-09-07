/** Lista stylów do wyboru w preferencjach. Użytkownik może też dopisać własny. */
export const GENRE_GROUPS: { label: string; genres: string[] }[] = [
  { label: "Death metal", genres: ["death metal", "technical death metal", "dissonant death metal", "old school death metal", "melodic death metal", "brutal death metal", "death doom"] },
  { label: "Black metal", genres: ["black metal", "atmospheric black metal", "blackened death metal", "avant-garde black metal", "dissonant black metal", "raw black metal", "post-black metal", "war metal / bestial"] },
  { label: "Inne metal", genres: ["doom metal", "funeral doom", "sludge", "thrash metal", "heavy metal", "post-metal", "grindcore", "folk metal", "stoner / psych", "gothic metal", "industrial metal"] },
  { label: "Prog", genres: ["progressive metal", "progressive rock", "post-progressive", "avant-prog / RIO", "krautrock", "canterbury", "symphonic prog", "jazz rock / fusion", "post-rock"] },
  { label: "Jazz", genres: ["modern jazz", "free jazz", "spiritual jazz", "hard bop", "cool jazz", "modal jazz", "nu jazz", "big band", "ECM / chamber jazz", "avant-garde jazz"] },
  { label: "Punk / hardcore", genres: ["punk", "punk rock", "post-punk", "hardcore punk", "crust", "d-beat", "noise rock"] },
  { label: "Country / americana", genres: ["country", "alt-country", "americana", "country rock", "honky-tonk", "bluegrass", "singer-songwriter"] },
  { label: "Poza", genres: ["dark ambient", "neofolk", "classical / contemporary", "electronic", "hip-hop", "pop"] },
];

export const ALL_GENRES = GENRE_GROUPS.flatMap((g) => g.genres);

/**
 * GŁÓWNE KATEGORIE — to, co wybiera człowiek w profilu.
 *
 * Wcześniej do wyboru było ~50 podgatunków i to była ślepa uliczka: nie da się
 * co tydzień budować listy premier dla „dissonant black metal". Wybiera się
 * więc black metal, death metal, ciężkie brzmienia — a podgatunki (GENRE_GROUPS
 * wyżej) zostają wyłącznie do klasyfikowania płyt i szukania w MusicBrainz.
 *
 * `tags` to nazwy, którymi pytamy MusicBrainz o premiery dla kategorii
 * nieobecnych w imporcie „Pure New Shit" (patrz scripts/fetch-releases.ts).
 * `fromImport` = kategoria, którą pokrywa import PNS, więc nie pytamy o nią MB.
 */
export interface MainCategory {
  slug: string;
  label: string;
  tags: string[];
  fromImport?: boolean;
}

export const MAIN_CATEGORIES: MainCategory[] = [
  { slug: "death", label: "Death metal", tags: ["death metal"], fromImport: true },
  { slug: "black", label: "Black metal", tags: ["black metal"], fromImport: true },
  { slug: "other", label: "Inne metal / ciężkie brzmienia", tags: ["doom metal", "sludge metal", "thrash metal", "post-metal"], fromImport: true },
  { slug: "prog", label: "Prog rock / prog metal", tags: ["progressive rock", "progressive metal"], fromImport: true },
  { slug: "jazz", label: "Jazz", tags: ["jazz"], fromImport: true },
  { slug: "punk", label: "Punk / hardcore", tags: ["punk", "hardcore punk", "post-punk"] },
  { slug: "country", label: "Country / americana", tags: ["country", "americana"] },
  { slug: "classical", label: "Klasyka", tags: ["classical", "contemporary classical"] },
  { slug: "electronic", label: "Elektronika", tags: ["electronic", "techno", "ambient"] },
  { slug: "hiphop", label: "Hip-hop", tags: ["hip hop"] },
  { slug: "pop", label: "Pop", tags: ["pop"] },
  { slug: "folk", label: "Folk / singer-songwriter", tags: ["folk", "singer-songwriter"] },
];

export const MAIN_BY_SLUG = new Map(MAIN_CATEGORIES.map((c) => [c.slug, c]));

/** Style, o które pytamy MusicBrainz — kategorie, których import PNS nie pokrywa. */
export const STYLES_FROM_MB_BY_CATEGORY = MAIN_CATEGORIES.filter((c) => !c.fromImport);

/**
 * Style, których import „Pure New Shit" nie pokrywa (PNS to death/black, prog
 * i jazz) — dla nich premiery dobieramy z MusicBrainz (scripts/fetch-releases.ts).
 * Świadomie krótka lista szerokich tagów: im węższy tag, tym częściej MB nie ma
 * go jeszcze na świeżej płycie.
 */
export const STYLES_FROM_MB = STYLES_FROM_MB_BY_CATEGORY.flatMap((c) => c.tags);

/** Mapowanie stylu użytkownika → sekcje premier (db/prog/other/jazz) do personalizacji. */
export function genreToSection(genre: string): "db" | "prog" | "other" | "jazz" | null {
  const g = genre.toLowerCase();
  if (g.includes("death") || g.includes("black") || g.includes("bestial")) return "db";
  if (g.includes("prog") || g.includes("kraut") || g.includes("canterbury") || g.includes("rio") || g.includes("fusion") || g.includes("post-rock")) return "prog";
  if (g.includes("jazz") || g.includes("bop") || g.includes("ecm") || g.includes("big band")) return "jazz";
  if (g.includes("metal") || g.includes("doom") || g.includes("sludge") || g.includes("grind") || g.includes("stoner") || g.includes("core") || g.includes("crust")) return "other";
  return null;
}

export const WEIGHT_LABELS: Record<number, string> = { 1: "od czasu do czasu", 2: "lubię", 3: "często", 4: "bardzo", 5: "to moje serce" };
