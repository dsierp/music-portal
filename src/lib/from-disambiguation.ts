/**
 * Zespoły wyczytane z JEDNOZDANIOWEGO OPISU przy artyście w MusicBrainz.
 *
 * Ostatnia deska ratunku, używana dopiero wtedy, gdy nie ma nic innego.
 * Perkusista Mgły ma w MusicBrainz opis „drummer of Mgła", ale ani jednej
 * relacji członkostwa — a Wikidane nie rozpisały składu zespołu. Bez tego jego
 * strona twierdzi, że nie grał nigdzie, choć baza wprost pisze, gdzie gra.
 *
 * To odczyt ze zdania, nie z pola bazy, więc traktujemy go podejrzliwie:
 * bierzemy tylko jasne wzorce „<rola> of <zespół>", ucinamy dopiski w nawiasach
 * i wszystko, co po nazwie dopowiada kontekst („, formerly…", „ – since 2004").
 * Wynik zawsze pokazujemy z podpisem, skąd pochodzi.
 */

/** Role, po których w opisach MusicBrainz idzie nazwa zespołu. */
const ROLA =
  "drummer|guitarist|bassist|bass player|vocalist|singer|keyboardist|keyboard player|pianist|saxophonist|violinist|percussionist|multi-instrumentalist|frontman|member|founder|co-founder|leader";

const WZORZEC = new RegExp(`\\b(?:${ROLA})\\s+(?:of|in|for|with)\\s+(.+)$`, "i");

/** Zdanie potrafi wymienić kilka zespołów: „drummer of A, B and C". */
function rozbij(ogon: string): string[] {
  return ogon
    .split(/\s*(?:,|;|\band\b|\boraz\b|\bi\b|&|\/)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

function oczysc(nazwa: string): string {
  return (
    nazwa
      // dopiski w nawiasach i wszystko po myślniku — to komentarz, nie nazwa
      .replace(/\([^)]*\)/g, " ")
      .replace(/\s+[–—-]\s+.*$/, "")
      // ogon typu „since 2004", „until 2010", „from Poland"
      .replace(/\b(?:since|until|from|between)\b.*$/i, "")
      .replace(/["'“”„]/g, "")
      .replace(/\s+/g, " ")
      .replace(/[.,;:]+$/, "")
      .trim()
  );
}

/**
 * Nazwy zespołów z opisu. Pusta lista, gdy opis nie pasuje do wzorca — a tak
 * jest w większości przypadków i to dobrze: wolimy nic nie pokazać, niż zmyślić.
 */
export function zespolyZOpisu(opis: string | null | undefined): string[] {
  if (!opis) return [];
  const trafienie = WZORZEC.exec(opis.trim());
  if (!trafienie) return [];
  const nazwy = rozbij(trafienie[1])
    .map(oczysc)
    // Jednoliterowe resztki i całe zdania odpadają: nazwa zespołu to nie zdanie.
    .filter((n) => n.length >= 2 && n.split(" ").length <= 5);
  return [...new Set(nazwy)].slice(0, 3);
}
