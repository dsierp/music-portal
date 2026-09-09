/**
 * Parsery wikitekstu — czyste funkcje, bez sieci i bez bazy.
 * Osobny moduł, żeby dało się je testować bez uruchamiania PGlite.
 */

export const PERSONNEL_HEADING = /skład|twórcy|muzycy|personel|obsada|personnel|musicians?|credits?|line-?up/i;

export function cleanWikitext(s: string): string {
  return s
    .replace(/<ref[^>]*\/>/gi, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "")
    .replace(/\{\{[^{}]*\}\}/g, "") // proste szablony (bez zagnieżdżeń)
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1") // [[link|tekst]] / [[tekst]] → tekst
    .replace(/'''?([^']*)'''?/g, "$1") // '''pogrubienie''' / ''kursywa''
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export interface PersonnelLine {
  /** Samo nazwisko — do dopasowania z MusicBrainz i zrobienia linku. */
  name: string;
  /** Reszta linii: instrumenty, role. */
  roles: string;
}

// "Paul Masvidal – wokal, gitara" → nazwisko + role. Myślnik musi mieć spacje wokół,
// żeby nie ciąć nazwisk typu "Jean-Luc Ponty".
const NAME_SPLIT = /\s+[–—-]\s+/;

export function splitPersonnelLine(line: string): PersonnelLine | null {
  const [namePart, ...rest] = line.split(NAME_SPLIT);
  const name = (namePart ?? "").trim();
  // Odsiewamy zdania i śmieci: nazwisko to 1–5 słów, bez kropki na końcu zdania.
  if (name.length < 2 || name.length > 60) return null;
  const words = name.split(/\s+/);
  if (words.length > 5) return null;
  return { name, roles: rest.join(" – ").trim() };
}

export interface WikiReview {
  source: string;
  score: string;
}

/**
 * Oceny prasowe z infoboksu Wikipedii ("Professional ratings" / "Oceny").
 *
 * To najlepsze dostępne nam źródło ocen: serwisy w rodzaju RateYourMusic czy
 * AlbumOfTheYear blokują automaty, a MusicBrainz prawie nigdy nie ma do nich
 * bezpośrednich linków. Wikipedia ma za to zebrane oceny redakcji (AllMusic,
 * Pitchfork, Sputnik…) w ustandaryzowanym szablonie.
 *
 * Szablon wygląda tak:
 *   {{Album ratings
 *    | rev1 = [[AllMusic]]
 *    | rev1Score = {{Rating|4.5|5}}
 *    | rev2 = [[Pitchfork]]
 *    | rev2score = 8.4/10 }}
 */
export function parseRatingsTemplate(wikitext: string): WikiReview[] {
  const start = wikitext.search(/\{\{\s*(album[ _]ratings|music[ _]ratings|ocena albumu|oceny albumu)/i);
  if (start < 0) return [];
  // Wytnij szablon licząc nawiasy klamrowe (w środku są zagnieżdżone {{Rating|…}}).
  let depth = 0;
  let end = start;
  for (let i = start; i < wikitext.length - 1; i++) {
    if (wikitext[i] === "{" && wikitext[i + 1] === "{") { depth++; i++; }
    else if (wikitext[i] === "}" && wikitext[i + 1] === "}") {
      depth--; i++;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  const body = wikitext.slice(start, end);

  const names = new Map<string, string>();
  const scores = new Map<string, string>();
  // Wartość może zawierać zagnieżdżony szablon z własnymi "|" ({{Rating|4|5}}),
  // więc najpierw próbujemy dopasować cały taki szablon, dopiero potem zwykły tekst.
  for (const m of body.matchAll(/\|\s*rev(\d+)(score)?\s*=\s*((?:\{\{[^{}]*\}\}|\[\[[^\]]*\]\]|[^|}])*)/gi)) {
    const [, idx, isScore, rawValue] = m;
    const value = rawValue.trim();
    if (!value) continue;
    if (isScore) scores.set(idx, cleanScore(value));
    else names.set(idx, cleanWikitext(value));
  }
  const out: WikiReview[] = [];
  for (const [idx, source] of names) {
    const score = scores.get(idx);
    if (source && score) out.push({ source, score });
  }
  return out.slice(0, 12);
}

/** "{{Rating|4.5|5}}" → "4.5/5"; "8.4/10" zostaje; "[[AllMusic]]" → "AllMusic". */
function cleanScore(raw: string): string {
  const rating = raw.match(/\{\{\s*rating\s*\|\s*([\d.]+)\s*(?:\|\s*([\d.]+)\s*)?/i);
  if (rating) return `${rating[1]}/${rating[2] ?? "5"}`;
  return cleanWikitext(raw);
}


/**
 * Skład zespołu z infoboksu Wikipedii.
 *
 * Trzecie źródło po MusicBrainz i Wikidanych — potrzebne, bo bywa jedynym.
 * Mgła: MusicBrainz nie ma ani jednej relacji członkostwa, a w Wikipedii skład
 * stoi w infoboksie jak byk. Lepiej wziąć go stamtąd z uczciwym podpisem, niż
 * pokazywać zespół bez ludzi.
 *
 * Infoboksy różnią się polami między językami, więc bierzemy wszystkie znane
 * warianty. Wartość bywa listą po gwiazdkach albo po „<br />" — tniemy po obu.
 */
const POLA_OBECNI = /^(current_members|muzycy|sk[łl]ad|obecny_sk[łl]ad|members)$/i;
const POLA_DAWNI = /^(past_members|byli_muzycy|byli_cz[łl]onkowie|dawny_sk[łl]ad|former_members)$/i;

export interface InfoboxMembers {
  current: PersonnelLine[];
  past: PersonnelLine[];
}

export function parseInfoboxMembers(wikitext: string): InfoboxMembers {
  const pusty: InfoboxMembers = { current: [], past: [] };
  const start = wikitext.search(/\{\{\s*infobox/i);
  if (start < 0) return pusty;
  // Wycinamy sam infoboks, licząc nawiasy — w środku siedzą inne szablony.
  let depth = 0;
  let end = wikitext.length;
  for (let i = start; i < wikitext.length - 1; i++) {
    if (wikitext[i] === "{" && wikitext[i + 1] === "{") { depth++; i++; }
    else if (wikitext[i] === "}" && wikitext[i + 1] === "}") {
      depth--; i++;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  const body = wikitext.slice(start, end);

  // Pola rozdziela „|" na początku linii; wartość może iść przez kilka linii.
  const pola = new Map<string, string>();
  let nazwa: string | null = null;
  let wartosc: string[] = [];
  const zapisz = () => {
    if (nazwa) pola.set(nazwa, wartosc.join("\n"));
    nazwa = null;
    wartosc = [];
  };
  for (const linia of body.split("\n")) {
    const m = linia.match(/^\s*\|\s*([A-Za-z_łóąćęśżźń0-9 ]+?)\s*=\s*(.*)$/);
    if (m) {
      zapisz();
      nazwa = m[1].trim().toLowerCase().replace(/\s+/g, "_");
      wartosc = [m[2]];
    } else if (nazwa) {
      wartosc.push(linia);
    }
  }
  zapisz();

  const osoby = (raw: string | undefined): PersonnelLine[] =>
    !raw
      ? []
      : raw
          .split(/<br\s*\/?>|\n\s*\*+|^\s*\*+/gim)
          .map((l) => cleanWikitext(l.replace(/^\s*\*+/, "")))
          .filter((l) => l.length > 1)
          .map(splitPersonnelLine)
          .filter((l): l is PersonnelLine => !!l)
          .slice(0, 30);

  const znajdz = (test: RegExp) => {
    for (const [k, v] of pola) if (test.test(k)) return v;
    return undefined;
  };
  return { current: osoby(znajdz(POLA_OBECNI)), past: osoby(znajdz(POLA_DAWNI)) };
}
