/** Lista stylów do wyboru w preferencjach. Użytkownik może też dopisać własny. */
export const GENRE_GROUPS: { label: string; genres: string[] }[] = [
  { label: "Death metal", genres: ["death metal", "technical death metal", "dissonant death metal", "old school death metal", "melodic death metal", "brutal death metal", "death doom"] },
  { label: "Black metal", genres: ["black metal", "atmospheric black metal", "blackened death metal", "avant-garde black metal", "dissonant black metal", "raw black metal", "post-black metal", "war metal / bestial"] },
  { label: "Inne metal", genres: ["doom metal", "funeral doom", "sludge", "thrash metal", "heavy metal", "post-metal", "grindcore", "folk metal", "stoner / psych", "gothic metal", "industrial metal"] },
  { label: "Prog", genres: ["progressive metal", "progressive rock", "post-progressive", "avant-prog / RIO", "krautrock", "canterbury", "symphonic prog", "jazz rock / fusion", "post-rock"] },
  { label: "Jazz", genres: ["modern jazz", "free jazz", "spiritual jazz", "hard bop", "cool jazz", "modal jazz", "nu jazz", "big band", "ECM / chamber jazz", "avant-garde jazz"] },
  { label: "Poza", genres: ["hardcore punk", "crust", "dark ambient", "neofolk", "classical / contemporary", "electronic", "hip-hop", "pop"] },
];

export const ALL_GENRES = GENRE_GROUPS.flatMap((g) => g.genres);

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
