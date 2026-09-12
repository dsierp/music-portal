/**
 * Klient MusicBrainz (https://musicbrainz.org/doc/MusicBrainz_API).
 * - limit 1 zapytanie/s (wymóg MB) — globalna kolejka,
 * - własny User-Agent (wymóg MB),
 * - cache w bazie (patrz cache.ts),
 * - normalizacja surowych odpowiedzi do prostych typów używanych przez strony.
 *
 * MBID (UUID) jest naszym kluczem dla płyt (release-group) i artystów (artist).
 * Muzycy (osoby) w MB też są "artist" — dzięki temu jedna strona /artist/[mbid]
 * obsługuje i zespół, i człowieka, a "podróż" po składach to zwykłe linki.
 */
import { cached, TTL } from "./cache";
import { createThrottle } from "./throttle";
import { czytelnaRola } from "./instruments";

/** Ile czekamy na jedną odpowiedź MusicBrainz (potem próba od nowa). */
const MB_TIMEOUT_MS = 8000;
const MB_BASE = "https://musicbrainz.org/ws/2";

/**
 * MusicBrainz wymaga, żeby aplikacja się przedstawiła — bez tego odpowiada 403
 * („the application you are using has not identified itself").
 *
 * Wcześniej stało tu `process.env.X ?? domyślne`, a `??` łapie tylko brak
 * zmiennej, NIE pusty tekst. Na Vercelu zmienna istniała, ale była pusta, więc
 * nagłówek szedł pusty i MB odcinał portal — przy działającym lokalnie macu,
 * gdzie zmienna miała wartość. Dlatego teraz: przycinamy, zdejmujemy cudzysłowy
 * (tak potrafi przyjechać wartość z importu pliku .env) i pilnujemy, żeby nigdy
 * nie zostało pusto.
 */
export function normalizeUserAgent(raw: string | undefined): string {
  const v = (raw ?? "").trim().replace(/^["']|["']$/g, "").trim();
  return v || "PureNewShit/0.1 ( https://music-travel.app )";
}
const UA = normalizeUserAgent(process.env.MUSICBRAINZ_USER_AGENT);

// ---------- rate limiter ----------
// Odstęp między wysłaniami zapytań (MusicBrainz: 1/s; 1,1 s daje zapas na
// nierówności sieci). Szczegóły działania kolejki: throttle.ts.
const MIN_GAP_MS = 1100;
const throttle = createThrottle(MIN_GAP_MS);

export class MbError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

/** Tryb testowy: MB_FIXTURES=<katalog> → odpowiedzi czytane z plików zamiast z sieci. */
export function fixtureName(path: string, params: Record<string, string | number>) {
  const q = Object.entries(params).sort().map(([k, v]) => `${k}=${v}`).join("&");
  return `${path}?${q}`.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "") + ".json";
}

async function mbFetch<T>(path: string, params: Record<string, string | number>): Promise<T> {
  if (process.env.MB_FIXTURES) {
    const fs = await import("node:fs/promises");
    const file = `${process.env.MB_FIXTURES}/${fixtureName(path, params)}`;
    try {
      return JSON.parse(await fs.readFile(file, "utf8")) as T;
    } catch {
      throw new MbError(`Brak fixture: ${file}`, 404);
    }
  }
  const url = new URL(MB_BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  url.searchParams.set("fmt", "json");
  return throttle(async () => {
    // MusicBrainz przy przeciążeniu odpowiada 503 i oczekuje, że odpuścimy na chwilę.
    // Cztery podejścia z rosnącą przerwą (1s, 2s, 4s) + losowy rozrzut, żeby kilka
    // równoległych zapytań nie wracało dokładnie w tej samej sekundzie.
    for (let attempt = 0; attempt < 4; attempt++) {
      let res: Response;
      try {
        // Twardy limit czasu: bez niego zadyszka MusicBrainz trzymała otwartą
        // odpowiedź naszej strony, aż przeglądarka odpuściła — a czytelnik
        // widział pustkę zamiast informacji, że baza nie odpowiada.
        res = await fetch(url, {
          headers: { "User-Agent": UA, Accept: "application/json" },
          cache: "no-store",
          signal: AbortSignal.timeout(MB_TIMEOUT_MS),
        });
      } catch {
        // zerwane połączenie / brak sieci — traktujemy jak chwilową niedostępność
        if (attempt === 3) throw new MbError("Brak połączenia z MusicBrainz", 503);
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        continue;
      }
      if (res.status === 503 || res.status === 429) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt + Math.random() * 400));
        continue;
      }
      if (res.status === 404) throw new MbError("Nie znaleziono w MusicBrainz", 404);
      if (!res.ok) {
        // Przy 403 samo „MusicBrainz 403" nic nie mówi: to może być blokada
        // adresu IP (serwerownie bywają blokowane hurtem) albo zły User-Agent.
        // MB pisze powód w treści odpowiedzi — zabieramy jej początek, bo bez
        // tego zgadywanie trwa tyle, co kolejne wdrożenia.
        const why = await res.text().then((t) => t.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160)).catch(() => "");
        throw new MbError(`MusicBrainz ${res.status}${why ? ` — ${why}` : ""}`, res.status);
      }
      return (await res.json()) as T;
    }
    throw new MbError("MusicBrainz jest chwilowo przeciążony", 503);
  });
}

// ---------- surowe typy MB (tylko pola, których używamy) ----------

export interface MbArtistCreditPart {
  name: string;
  joinphrase?: string;
  artist: { id: string; name: string; disambiguation?: string; type?: string };
}
interface MbTag { name: string; count: number }
interface MbArtistRel {
  type: string;
  direction: "forward" | "backward";
  attributes?: string[];
  begin?: string | null;
  end?: string | null;
  ended?: boolean;
  artist?: { id: string; name: string; type?: string; disambiguation?: string };
  release?: { id: string; title: string; date?: string; "artist-credit"?: MbArtistCreditPart[] };
  "release-group"?: { id: string; title: string; "first-release-date"?: string; "artist-credit"?: MbArtistCreditPart[] };
  "target-type": string;
  url?: { resource: string };
}
export interface MbReleaseGroup {
  id: string;
  title: string;
  "primary-type"?: string | null;
  "secondary-types"?: string[];
  "first-release-date"?: string;
  disambiguation?: string;
  "artist-credit"?: MbArtistCreditPart[];
  releases?: MbReleaseStub[];
  genres?: MbTag[];
  tags?: MbTag[];
  relations?: MbArtistRel[];
  rating?: { value?: number | null; "votes-count"?: number };
}
interface MbReleaseStub {
  id: string;
  title: string;
  status?: string;
  date?: string;
  country?: string;
  "track-count"?: number;
  "release-group"?: { id: string; title: string; "primary-type"?: string | null; "secondary-types"?: string[]; "first-release-date"?: string; "artist-credit"?: MbArtistCreditPart[] };
  "artist-credit"?: MbArtistCreditPart[];
}
interface MbRecording {
  id: string;
  title: string;
  length?: number | null;
  "artist-credit"?: MbArtistCreditPart[];
  relations?: MbArtistRel[];
  releases?: MbReleaseStub[];
}
interface MbRelease {
  id: string;
  title: string;
  date?: string;
  "artist-credit"?: MbArtistCreditPart[];
  country?: string;
  status?: string;
  "label-info"?: { label?: { id: string; name: string } | null; "catalog-number"?: string | null }[];
  media?: { position: number; format?: string; title?: string; tracks: { position: number; number: string; title: string; length?: number | null; recording: MbRecording }[] }[];
  relations?: MbArtistRel[];
  "release-group"?: MbReleaseGroup;
}
export interface MbArtist {
  id: string;
  name: string;
  "sort-name": string;
  type?: string | null;
  country?: string | null;
  area?: { name: string } | null;
  "begin-area"?: { name: string } | null;
  disambiguation?: string;
  "life-span"?: { begin?: string | null; end?: string | null; ended?: boolean };
  genres?: MbTag[];
  tags?: MbTag[];
  relations?: MbArtistRel[];
  aliases?: { name: string; primary?: boolean | null }[];
}

// ---------- znormalizowane typy aplikacji ----------

export interface CreditPart { name: string; mbid: string; join: string }
export interface AlbumSummary {
  mbid: string;
  title: string;
  credit: CreditPart[];
  artistText: string;
  firstReleaseDate: string | null;
  year: string | null;
  primaryType: string | null;
  secondaryTypes: string[];
  disambiguation: string | null;
  /**
   * Ocena społeczności MusicBrainz (1–5) i liczba głosów. Przychodzi za darmo
   * razem z dyskografią, a pozwala wskazać „tę jedną" płytę zespołu, zanim
   * ktokolwiek oceni cokolwiek w portalu.
   */
  mbRating?: { value: number; votes: number } | null;
}
export interface Links {
  spotify: string;
  tidal: string;
  bandcamp?: string;
  wikipedia?: string;
  wikidata?: string;
  discogs?: string;
  metalArchives?: string;
  allmusic?: string;
  official?: string;
  youtube?: string;
  rateYourMusic?: string;
  albumOfTheYear?: string;
  sputnikmusic?: string;
  progArchives?: string;
  /**
   * Klucze linków, które przyszły z realnej relacji MusicBrainz (a nie z wyszukiwania-fallback).
   * Tylko takie linki wskazują na dokładnie tę płytę/artystę — warto próbować z nich
   * wyciągać oceny (patrz externalRatings.ts). Fallbacki (wyszukiwarka) tego nie gwarantują.
   */
  exact?: (keyof Links)[];
}
export interface Track {
  disc: number;
  position: number;
  number: string;
  title: string;
  lengthMs: number | null;
  recordingMbid: string;
}
export interface Credit {
  mbid: string;
  name: string;
  roles: string[]; // np. "vocals", "guitar", "producer"
  trackCount: number; // na ilu nagraniach
  onAllTracks: boolean;
}
export interface Album extends AlbumSummary {
  genres: string[];
  tags: string[];
  links: Links;
  releaseMbid: string | null;
  releaseDate: string | null;
  labels: string[];
  tracks: Track[];
  credits: Credit[];
  coverUrl: string;
  /** Ocena społeczności MusicBrainz (0–5) — jedyne źródło ocen, które zawsze mamy bez scrapowania. */
  mbRating: { value: number; votes: number } | null;
}
/**
 * Wynik wyszukiwania artysty — świadomie bogatszy niż sama nazwa.
 *
 * „Cynic" w MusicBrainz to co najmniej trzy zespoły; sam napis „group · US"
 * nie mówi, który jest który. Wszystkie te pola przychodzą JEDNYM zapytaniem
 * (odpowiedź wyszukiwarki MB i tak je zawiera), więc nic nas nie kosztują.
 */
export interface ArtistHit {
  mbid: string;
  name: string;
  type: string | null;
  isPerson: boolean;
  country: string | null;
  disambiguation: string | null;
  begin: string | null;
  end: string | null;
  ended: boolean;
  area: string | null;
  city: string | null;
  tags: string[];
  aliases: string[];
}

export interface Membership {
  mbid: string;
  name: string;
  type: string | null;
  roles: string[];
  begin: string | null;
  end: string | null;
  current: boolean;
  /**
   * true = współpraca, nie członkostwo („instrumental/vocal supporting
   * musician"). Tak MusicBrainz opisuje granie u kogoś na etacie sidemana:
   * Mike Bordin bębnił u Ozzy'ego Osbourne'a 1996–2010, ale członkiem żadnego
   * „zespołu Ozzy'ego" nie był. Bez tego pola takie granie w ogóle nam znikało.
   */
  supporting?: boolean;
  /**
   * Skąd są daty, gdy nie z MusicBrainz. MB nagminnie ma gołą relację bez dat
   * (Inferno w Behemocie od 1997) — wtedy dobieramy je z Wikidanych i mówimy
   * o tym wprost na osi, zamiast udawać, że to ten sam materiał.
   */
  datesFrom?: "wikidata";
  /**
   * Skąd wzięliśmy tę osobę, gdy MusicBrainz nie zna jej w ogóle. Mgła ma
   * skład w Wikipedii, a w MusicBrainz ani jednej relacji — lepiej pokazać
   * z podpisem skąd, niż udawać, że zespół nie ma składu. Rozróżniamy źródła,
   * bo Wikidane to dane strukturalne, a infoboks Wikipedii — tekst.
   */
  external?: "wikidata" | "wikipedia" | "opis";
}
export interface Artist {
  mbid: string;
  name: string;
  sortName: string;
  type: string | null; // Group | Person | Orchestra | ...
  isPerson: boolean;
  country: string | null;
  area: string | null;
  begin: string | null;
  end: string | null;
  ended: boolean;
  disambiguation: string | null;
  genres: string[];
  tags: string[];
  links: Links;
  members: Membership[]; // dla zespołu: ludzie
  memberOf: Membership[]; // dla osoby: zespoły
  aliases: string[];
  /** produkcja, realizacja, okładki — praca przy wydaniach, nie granie */
  workedOn: WorkedOn[];
  /**
   * Granie wpisane przy WYDANIU, wzięte z samego lookupu artysty.
   *
   * To najpewniejsze źródło dorobku sesyjnego: jedno zapytanie zwraca komplet
   * relacji tej osoby, bez stronicowania. Przeglądanie wydań (`getPlayedOn`)
   * chodzi po setkach pozycji i przy kimś tak płodnym jak Colaiuta urywa się
   * zanim dojdzie do Stinga — a tutaj „Sacred Love" jest od razu.
   */
  sessionOn: WorkedOn[];
}
/**
 * Praca przy wydaniu, która NIE jest graniem: produkcja, realizacja dźwięku,
 * miks, mastering, okładka. W MusicBrainz takie relacje wiszą przy wydaniu,
 * a nie przy nagraniu — dlatego producent w rodzaju Scotta Burnsa miał do tej
 * pory pustą stronę, mimo setek płyt na koncie.
 */
export interface WorkedOn {
  /** id wydania (release) — nie release-group; rozwiązujemy je dopiero po kliknięciu */
  releaseMbid: string;
  title: string;
  artistText: string;
  date: string | null;
  roles: string[];
}

export interface PlayedOn {
  album: AlbumSummary;
  roles: string[];
  /**
   * Ile utworów — z relacji przy NAGRANIACH. Zero znaczy „kredyt wpisany przy
   * całym wydaniu", a nie „zagrał na zero utworów": tak MusicBrainz zapisuje
   * większość sesyjnego grania i wtedy liczby po prostu nie ma.
   */
  trackCount: number;
  /** nazwa zespołu, jeśli płyta jest jednego z zespołów muzyka (z memberOf); null = gościnnie/sesyjnie */
  withBand: string | null;
}

// ---------- helpery normalizacji ----------

export function normCredit(ac?: MbArtistCreditPart[]): CreditPart[] {
  return (ac ?? []).map((p) => ({ name: p.name, mbid: p.artist.id, join: p.joinphrase ?? "" }));
}
export function creditText(c: CreditPart[]) {
  return c.map((p) => p.name + p.join).join("");
}
function topNames(tags?: MbTag[], n = 6) {
  return [...(tags ?? [])].sort((a, b) => b.count - a.count).slice(0, n).map((t) => t.name);
}

export function normReleaseGroup(rg: MbReleaseGroup | NonNullable<MbReleaseStub["release-group"]>, creditFallback?: MbArtistCreditPart[]): AlbumSummary {
  const credit = normCredit(rg["artist-credit"] ?? creditFallback);
  const date = rg["first-release-date"] || null;
  return {
    mbid: rg.id,
    title: rg.title,
    credit,
    artistText: creditText(credit),
    firstReleaseDate: date,
    year: date ? date.slice(0, 4) : null,
    primaryType: rg["primary-type"] ?? null,
    secondaryTypes: rg["secondary-types"] ?? [],
    disambiguation: ("disambiguation" in rg && rg.disambiguation) || null,
    mbRating:
      "rating" in rg && rg.rating?.value != null
        ? { value: rg.rating.value, votes: rg.rating["votes-count"] ?? 0 }
        : null,
  };
}

/** Linki: bezpośrednie z MB (url-rels), a gdy brak — wyszukiwanie. */
export function buildLinks(rels: MbArtistRel[] | undefined, query: string, isJazz = false): Links {
  const q = encodeURIComponent(query);
  const links: Links = {
    spotify: `https://open.spotify.com/search/${q}`,
    tidal: `https://listen.tidal.com/search?q=${q}`,
  };
  const exact: (keyof Links)[] = [];
  const setExact = (key: keyof Links, url: string) => {
    (links as unknown as Record<string, string>)[key] = url;
    exact.push(key);
  };
  for (const r of rels ?? []) {
    const u = r.url?.resource;
    if (!u) continue;
    if (u.includes("open.spotify.com")) setExact("spotify", u);
    else if (u.includes("tidal.com")) setExact("tidal", u);
    else if (u.includes("bandcamp.com")) setExact("bandcamp", u);
    else if (u.includes("wikipedia.org")) setExact("wikipedia", u);
    else if (u.includes("wikidata.org")) setExact("wikidata", u);
    else if (u.includes("discogs.com")) setExact("discogs", u);
    else if (u.includes("metal-archives.com")) setExact("metalArchives", u);
    else if (u.includes("allmusic.com")) setExact("allmusic", u);
    else if (u.includes("youtube.com")) setExact("youtube", u);
    else if (u.includes("rateyourmusic.com")) setExact("rateYourMusic", u);
    else if (u.includes("albumoftheyear.org")) setExact("albumOfTheYear", u);
    else if (u.includes("sputnikmusic.com")) setExact("sputnikmusic", u);
    else if (u.includes("progarchives.com")) setExact("progArchives", u);
    else if (r.type === "official homepage") setExact("official", u);
  }
  links.exact = exact;
  if (!links.bandcamp) links.bandcamp = `https://bandcamp.com/search?q=${q}&item_type=a`;
  if (!links.metalArchives && !isJazz) links.metalArchives = `https://www.metal-archives.com/search?searchString=${q}&type=band_name`;
  if (!links.allmusic) links.allmusic = `https://www.allmusic.com/search/all/${q}`;
  if (!links.discogs) links.discogs = `https://www.discogs.com/search/?q=${q}`;
  // strony z ocenami/recenzjami — MB rzadko zna bezpośredni link, więc zawsze przynajmniej wyszukiwanie
  if (!links.rateYourMusic) links.rateYourMusic = `https://rateyourmusic.com/search?searchterm=${q}`;
  if (!links.albumOfTheYear) links.albumOfTheYear = `https://www.albumoftheyear.org/search/?q=${q}`;
  if (!links.sputnikmusic && !isJazz) links.sputnikmusic = `https://www.sputnikmusic.com/search/?searchTerm=${q}`;
  return links;
}

/**
 * Rola z relacji MB: "instrument" + attributes → "guitar"; "vocal" → "vocals"; inne → typ.
 *
 * Po drodze zamieniamy żargon klasyfikacji instrumentów na nazwy, które ktoś
 * rozpozna — patrz `czytelnaRola`. Robimy to TU, przy wejściu danych, żeby
 * każdy widok (skład, oś czasu, kredyty) mówił tym samym językiem.
 */
function rolesOf(r: MbArtistRel): string[] {
  const attrs = (r.attributes ?? [])
    .filter((a) => !["additional", "guest", "solo", "minor"].includes(a))
    .map(czytelnaRola);
  if (r.type === "instrument") return attrs.length ? [...new Set(attrs)] : ["instrument"];
  if (r.type === "vocal") return attrs.length ? attrs : ["vocals"];
  if (r.type === "performer") return attrs.length ? attrs : ["performer"];
  if (r.type === "performing orchestra") return ["orchestra"];
  if (r.type === "conductor") return ["conductor"];
  return [r.type]; // producer, mix, mastering, engineer, recording, arranger, composer…
}
const PERFORMANCE_TYPES = new Set(["instrument", "vocal", "performer", "performing orchestra", "conductor"]);

/**
 * Role, które NIE są graniem ani śpiewaniem.
 *
 * Wzorzec, a nie lista dokładnych napisów — bo lista przepuszczała wszystko,
 * czego nie przewidziała. MusicBrainz zapisuje to samo na kilka sposobów
 * („design", „cover design", „graphic design", „artwork"), więc autorzy okładek
 * Demigoda lądowali wśród muzyków Behemotha. Wzorzec łapie każdą odmianę.
 *
 * Kompozytor i aranżer też są tutaj: to nieocenione role, ale odpowiadają na
 * pytanie „kto to napisał", a sekcja wyżej odpowiada na „kto to zagrał".
 */
const NIE_MUZYK =
  /produc|mix|master|engineer|recording|editor|design|illustration|photograph|art direction|graphic|artwork|layout|lettering|misc|programming|liner notes|copyright|publishing|booking|legal|management|A&R|arrang|compos|lyric|writ/i;

export function isMusicianRole(role: string) {
  return !NIE_MUZYK.test(role);
}

// ---------- wyszukiwanie ----------

function lucene(s: string) {
  return s.replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, " ").replace(/\s+/g, " ").trim();
}

export async function searchAlbums(query: string, limit = 20): Promise<AlbumSummary[]> {
  const q = lucene(query);
  if (!q) return [];
  const data = await cached(`mb:rg-search:${q}:${limit}`, TTL.search, () =>
    mbFetch<{ "release-groups": MbReleaseGroup[] }>("/release-group/", { query: q, limit }),
  );
  return data["release-groups"].map((rg) => normReleaseGroup(rg));
}

/**
 * Szukanie z zawężeniem: osobno artysta, osobno tytuł płyty.
 *
 * Po co, skoro jest jedno pole: „Sigh" w jednym polu zwraca wszystko, w czym
 * to słowo się pojawia — tytuły, wytwórnie, przypadkowe zbitki. Rozbicie na
 * `artist:` i `releasegroup:` pyta MusicBrainz dokładnie o to, o co chodzi,
 * i wystarczy wypełnić jedno z pól.
 */
export async function searchAlbumsBy(opts: { artist?: string; title?: string }, limit = 20): Promise<AlbumSummary[]> {
  const a = lucene(opts.artist ?? "");
  const t = lucene(opts.title ?? "");
  const parts: string[] = [];
  if (t) parts.push(`releasegroup:"${t}"`);
  if (a) parts.push(`artist:"${a}"`);
  if (!parts.length) return [];
  return mbSearchReleaseGroups(parts.join(" AND "), limit);
}

/**
 * Surowe wyszukiwanie release-group składnią Lucene MB (bez czyszczenia zapytania —
 * używamy go tam, gdzie sami budujemy query z operatorami, np. premiery tygodnia).
 */
export async function mbSearchReleaseGroups(query: string, limit = 25): Promise<AlbumSummary[]> {
  const data = await cached(`mb:rg-raw:${query}:${limit}`, TTL.search, () =>
    mbFetch<{ "release-groups": MbReleaseGroup[] }>("/release-group/", { query, limit }),
  );
  return (data["release-groups"] ?? []).map((rg) => normReleaseGroup(rg));
}

/** release → release-group (nasze strony płyt stoją na release-group). */
export async function releaseGroupOfRelease(releaseMbid: string): Promise<string | null> {
  return cached(`mb:rel2rg:${releaseMbid}`, TTL.lookup, async () => {
    const r = await mbFetch<{ "release-group"?: { id: string } }>(`/release/${releaseMbid}`, { inc: "release-groups" });
    return r["release-group"]?.id ?? null;
  });
}

/** Zapytanie do indeksu artystów: sam tekst albo tekst zawężony do typu. */
/**
 * Zapytanie o artystę. `rozmyte` dokłada wariant z tolerancją na literówkę
 * (`~` w Lucene) do słów od czterech znaków — krótsze zostawiamy w spokoju, bo
 * przy „Sun" czy „Nile" rozmycie sprowadziłoby pół bazy.
 *
 * Rozmycia NIE używamy domyślnie: takie zapytanie jest dla wyszukiwarki
 * MusicBrainz dużo droższe i przy popularnych hasłach („blink-182") kończyło się
 * przeciążeniem, czyli zerem wyników zamiast czegokolwiek. Woła je dopiero
 * `searchArtists`, gdy dokładne szukanie nic nie znalazło.
 */
export function artistQuery(query: string, kind?: "group" | "person", rozmyte = false): string {
  const q = lucene(query);
  if (!q) return "";
  const tresc = rozmyte
    ? q.split(" ").map((w) => (w.length >= 4 ? `(${w} OR ${w}~)` : w)).join(" ")
    : q;
  return kind ? `${tresc} AND type:${kind}` : tresc;
}

/**
 * `kind` zawęża do zespołu albo do człowieka. MusicBrainz trzyma jednych
 * i drugich w tym samym indeksie, więc bez tego „Cynic" zwraca i kapelę,
 * i producenta d&b — a szuka się zwykle albo jednego, albo drugiego.
 */
export async function searchArtists(
  query: string,
  limit = 20,
  kind?: "group" | "person",
): Promise<ArtistHit[]> {
  const pytaj = async (rozmyte: boolean) => {
    const full = artistQuery(query, kind, rozmyte);
    if (!full) return null;
    // v2: doszły lata działalności, gatunki i miasto — patrz ArtistHit.
    return cached(`mb:artist-search:v2:${full}:${limit}`, TTL.search, () =>
      mbFetch<{ artists: MbArtist[] }>("/artist/", { query: full, limit }),
    );
  };

  // Najpierw dokładnie — tak wygląda 99% szukań i tak jest najtaniej.
  // Rozmycie („viennie" → Vinnie) tylko wtedy, gdy dokładne nic nie dało.
  let data = await pytaj(false);
  if (!data) return [];
  if (!data.artists.length) data = (await pytaj(true).catch(() => null)) ?? data;

  return data.artists.map((a) => ({
    mbid: a.id,
    name: a.name,
    type: a.type ?? null,
    isPerson: a.type === "Person",
    country: a.country ?? null,
    disambiguation: a.disambiguation || null,
    begin: a["life-span"]?.begin ?? null,
    end: a["life-span"]?.end ?? null,
    ended: Boolean(a["life-span"]?.ended),
    area: a.area?.name ?? null,
    city: a["begin-area"]?.name ?? null,
    // Tagi bywają śmieciowe, więc bierzemy tylko te, które ktoś realnie poparł.
    tags: (a.tags ?? []).filter((t) => t.count > 0).sort((x, y) => y.count - x.count).map((t) => t.name).slice(0, 3),
    aliases: (a.aliases ?? []).map((x) => x.name).slice(0, 3),
  }));
}

/** Szuka release-group po artyście i tytule (do rozwiązywania premier/best-of na MBID). */
export async function findAlbumMbid(artist: string, album: string): Promise<AlbumSummary | null> {
  const a = lucene(artist), t = lucene(album);
  if (!a || !t) return null;
  const pytaj = async (query: string) => {
    const data = await cached(`mb:rg-find:v2:${query}`, TTL.lookup, () =>
      mbFetch<{ "release-groups": (MbReleaseGroup & { score?: number })[] }>("/release-group/", { query, limit: 5 }),
    );
    return data["release-groups"] ?? [];
  };
  // Najpierw po polach — precyzyjnie. Potem luźno, bo zapis po obu stronach bywa
  // różny („LINDA" vs „Linda", myślniki, znaki diakrytyczne, dopiski wydawcy),
  // a przy ścisłym zapytaniu takie drobiazgi dają zero trafień i człowiek
  // zamiast płyty ląduje w wyszukiwarce.
  let wyniki = await pytaj(`releasegroup:"${t}" AND artist:"${a}"`);
  if (!wyniki.length) wyniki = await pytaj(`${t} AND artist:${a}`);
  const best = wyniki.find((rg) => (rg.score ?? 0) >= 80) ?? wyniki[0];
  return best ? normReleaseGroup(best) : null;
}

// ---------- płyta (release-group + wybrane wydanie) ----------

function pickRelease(releases: MbReleaseStub[] | undefined): MbReleaseStub | null {
  if (!releases?.length) return null;
  const official = releases.filter((r) => !r.status || r.status === "Official");
  const pool = official.length ? official : releases;
  return [...pool].sort((x, y) => {
    const dx = x.date || "9999", dy = y.date || "9999";
    if (dx !== dy) return dx < dy ? -1 : 1;
    return (y["track-count"] ?? 0) - (x["track-count"] ?? 0);
  })[0];
}

export async function getAlbum(mbid: string): Promise<Album> {
  const rg = await cached(`mb:rg:${mbid}`, TTL.lookup, () =>
    mbFetch<MbReleaseGroup>(`/release-group/${mbid}`, { inc: "artist-credits+releases+url-rels+genres+tags+ratings" }),
  );
  const summary = normReleaseGroup(rg);
  const chosen = pickRelease(rg.releases);
  let rel: MbRelease | null = null;
  if (chosen) {
    rel = await cached(`mb:release:${chosen.id}`, TTL.lookup, () =>
      mbFetch<MbRelease>(`/release/${chosen.id}`, {
        inc: "recordings+artist-credits+artist-rels+recording-level-rels+labels+url-rels",
      }),
    );
  }

  // Ścieżki
  const tracks: Track[] = [];
  const creditMap = new Map<string, { name: string; roles: Set<string>; tracks: Set<string> }>();
  const addCredit = (r: MbArtistRel, trackKey: string | null) => {
    if (!r.artist || r["target-type"] !== "artist") return;
    const e = creditMap.get(r.artist.id) ?? { name: r.artist.name, roles: new Set<string>(), tracks: new Set<string>() };
    rolesOf(r).forEach((x) => e.roles.add(x));
    if (trackKey) e.tracks.add(trackKey);
    creditMap.set(r.artist.id, e);
  };
  for (const m of rel?.media ?? []) {
    for (const t of m.tracks) {
      const key = `${m.position}-${t.position}`;
      tracks.push({ disc: m.position, position: t.position, number: t.number, title: t.title, lengthMs: t.length ?? t.recording.length ?? null, recordingMbid: t.recording.id });
      for (const r of t.recording.relations ?? []) addCredit(r, key);
    }
  }
  for (const r of rel?.relations ?? []) if (r["target-type"] === "artist") addCredit(r, null);

  const total = tracks.length;
  const credits: Credit[] = [...creditMap.entries()]
    .map(([id, e]) => ({ mbid: id, name: e.name, roles: [...e.roles], trackCount: e.tracks.size, onAllTracks: total > 0 && e.tracks.size === total }))
    .sort((a, b) => {
      const am = a.roles.some((r) => isMusicianRole(r)) ? 0 : 1;
      const bm = b.roles.some((r) => isMusicianRole(r)) ? 0 : 1;
      return am - bm || b.trackCount - a.trackCount || a.name.localeCompare(b.name);
    });

  const genres = topNames(rg.genres);
  const isJazz = genres.some((g) => g.includes("jazz"));
  const links = buildLinks([...(rg.relations ?? []), ...(rel?.relations ?? [])].filter((r) => r["target-type"] === "url"), `${summary.artistText} ${summary.title}`, isJazz);

  return {
    ...summary,
    genres,
    tags: topNames(rg.tags, 10),
    links,
    releaseMbid: rel?.id ?? null,
    releaseDate: rel?.date ?? null,
    labels: [...new Set((rel?.["label-info"] ?? []).map((l) => l.label?.name).filter((x): x is string => !!x))],
    tracks,
    credits,
    coverUrl: `https://coverartarchive.org/release-group/${mbid}/front-250`,
    mbRating: rg.rating?.value != null ? { value: rg.rating.value, votes: rg.rating["votes-count"] ?? 0 } : null,
  };
}

// ---------- artysta ----------

/**
 * Typy relacji artysta–artysta, które traktujemy jak „grał z".
 *
 * Samo „member of band" gubi sidemanów, a to bywa najważniejsze granie
 * w życiorysie — Mike Bordin bębnił u Ozzy'ego Osbourne'a w latach 1996–2010
 * i w MusicBrainz jest to „instrumental supporting musician", nie członkostwo.
 */
const MEMBER_RELS = new Set(["member of band", "instrumental supporting musician", "vocal supporting musician"]);
export function isMembershipRelation(type: string): boolean {
  return MEMBER_RELS.has(type);
}

function normMembership(r: MbArtistRel): Membership | null {
  if (!r.artist) return null;
  return {
    supporting: r.type !== "member of band",
    mbid: r.artist.id,
    name: r.artist.name,
    type: r.artist.type ?? null,
    roles: (r.attributes ?? []).filter((a) => !["original", "founder"].includes(a)),
    begin: r.begin ?? null,
    end: r.end ?? null,
    current: !r.ended,
  };
}

export async function getArtist(mbid: string): Promise<Artist> {
  // v2: doszło `artist-credits`. Bez tego wydania przy relacjach wracały bez
  // wykonawcy i sesyjne kredyty wyglądały jak sieroty: „Sacred Love", a nie
  // „Sting – Sacred Love". Przy perkusiście to pół informacji — bo najciekawsze
  // jest właśnie U KOGO grał.
  const a = await cached(`mb:artist:v2:${mbid}`, TTL.lookup, () =>
    mbFetch<MbArtist>(`/artist/${mbid}`, {
      inc: "artist-rels+release-rels+release-group-rels+url-rels+genres+tags+aliases+artist-credits",
    }),
  );
  const members: Membership[] = [];
  const memberOf: Membership[] = [];
  for (const r of a.relations ?? []) {
    if (r["target-type"] !== "artist" || !MEMBER_RELS.has(r.type)) continue;
    const m = normMembership(r);
    if (!m) continue;
    // Dla zespołu: relacja wskazuje na członka (direction backward).
    // Dla osoby: relacja wskazuje na zespół albo artystę, u którego grała (forward).
    if (r.direction === "backward") members.push(m);
    else memberOf.push(m);
  }
  const byCurrent = (x: Membership, y: Membership) => Number(y.current) - Number(x.current) || (x.begin ?? "").localeCompare(y.begin ?? "");
  members.sort(byCurrent);
  memberOf.sort(byCurrent);
  /**
   * Produkcja, realizacja, okładki — relacje przypięte do WYDAŃ.
   *
   * Dwa filtry, oba wzięły się z tego, co widać było na stronie Vinnie
   * Colaiuty. Po pierwsze: przy wydaniu wiszą też kredyty za GRANIE
   * („drums (drum set)", „vocals"), a te należą do „Grał(a) na płytach" —
   * sekcja o produkcji, w której trzy czwarte pozycji to bębny, kłamie.
   * Po drugie: ta sama płyta ma po kilka wydań (reedycje, wersje krajowe),
   * każde z własną relacją — więc scalamy po tytule i roku, sumując role.
   */
  const workedMap = new Map<string, WorkedOn>();
  const sessionMap = new Map<string, WorkedOn>();
  for (const r of a.relations ?? []) {
    const rel = r.release ?? r["release-group"];
    if (!rel || (r["target-type"] !== "release" && r["target-type"] !== "release_group")) continue;
    const wszystkie = rolesOf(r);
    const przyPulpicie = wszystkie.filter((x) => !isMusicianRole(x));
    const granie = wszystkie.filter((x) => isMusicianRole(x));
    if (!przyPulpicie.length && !granie.length) continue;
    const credit = normCredit(rel["artist-credit"]);
    const relDate = ("date" in rel ? rel.date : undefined) ?? ("first-release-date" in rel ? rel["first-release-date"] : undefined) ?? null;
    const klucz = `${rel.title.toLowerCase()}|${(relDate ?? "").slice(0, 4)}`;
    const dopisz = (mapa: Map<string, WorkedOn>, role: string[]) => {
      if (!role.length) return;
      const e: WorkedOn = mapa.get(klucz) ?? {
        releaseMbid: rel.id,
        title: rel.title,
        artistText: creditText(credit),
        date: relDate,
        roles: [],
      };
      for (const rola of role) if (!e.roles.includes(rola)) e.roles.push(rola);
      mapa.set(klucz, e);
    };
    dopisz(workedMap, przyPulpicie);
    dopisz(sessionMap, granie);
  }
  const poDacie = (x: WorkedOn, y: WorkedOn) => (y.date ?? "").localeCompare(x.date ?? "");
  const workedOn = [...workedMap.values()].sort(poDacie);
  const sessionOn = [...sessionMap.values()].sort(poDacie);

  const genres = topNames(a.genres);
  const isJazz = genres.some((g) => g.includes("jazz"));
  return {
    mbid: a.id,
    name: a.name,
    sortName: a["sort-name"],
    type: a.type ?? null,
    isPerson: a.type === "Person",
    country: a.country ?? null,
    area: a.area?.name ?? a["begin-area"]?.name ?? null,
    begin: a["life-span"]?.begin ?? null,
    end: a["life-span"]?.end ?? null,
    ended: !!a["life-span"]?.ended,
    disambiguation: a.disambiguation || null,
    genres,
    tags: topNames(a.tags, 10),
    links: buildLinks((a.relations ?? []).filter((r) => r["target-type"] === "url"), a.name, isJazz),
    members,
    memberOf,
    aliases: (a.aliases ?? []).map((x) => x.name).filter((n) => n !== a.name).slice(0, 5),
    workedOn,
    sessionOn,
  };
}

/** Dyskografia (release-groups, w których artysta jest w artist credit). */
export async function getDiscography(mbid: string): Promise<AlbumSummary[]> {
  const data = await cached(`mb:rg-browse:${mbid}`, TTL.lookup, async () => {
    const out: MbReleaseGroup[] = [];
    for (let offset = 0; offset < 300; offset += 100) {
      const page = await mbFetch<{ "release-groups": MbReleaseGroup[]; "release-group-count": number }>("/release-group/", {
        artist: mbid, limit: 100, offset, inc: "artist-credits+ratings",
      });
      out.push(...page["release-groups"]);
      if (out.length >= page["release-group-count"]) break;
    }
    return out;
  });
  const order: Record<string, number> = { Album: 0, EP: 1, Single: 3, Other: 4, Broadcast: 5 };
  return data
    .map((rg) => normReleaseGroup(rg))
    .sort((x, y) => {
      const ox = order[x.primaryType ?? "Other"] ?? 4, oy = order[y.primaryType ?? "Other"] ?? 4;
      const sx = x.secondaryTypes.length ? 1 : 0, sy = y.secondaryTypes.length ? 1 : 0;
      return ox - oy || sx - sy || (y.firstReleaseDate ?? "").localeCompare(x.firstReleaseDate ?? "");
    });
}

/**
 * Nagrania powiązane z artystą — i przez artist credit, i przez relacje.
 *
 * Wspólne dla „grał na" i „produkował", bo to dokładnie ta sama paczka danych.
 * Klucz bufora jest jeden, więc druga sekcja strony dostaje ją za darmo.
 */
async function browseRecordingsOf(mbid: string, stron = STRON_DOMYSLNIE): Promise<MbRecording[]> {
  return cached(`mb:rec-browse:v2:${mbid}:${stron}`, TTL.lookup, async () => {
    const out: MbRecording[] = [];
    for (let offset = 0; offset < stron * 100; offset += 100) {
      const page = await mbFetch<{ recordings: MbRecording[]; "recording-count": number }>("/recording/", {
        artist: mbid, limit: 100, offset, inc: "releases+release-groups+artist-credits+artist-rels",
      });
      out.push(...page.recordings);
      if (out.length >= page["recording-count"]) break;
    }
    return out;
  });
}

/**
 * Płyty, na których muzyk grał (relacje wykonawca↔nagranie), a nie jest głównym wykonawcą.
 * To jest silnik "podróży": z płyty do muzyka, z muzyka do innych płyt.
 */
export async function getPlayedOn(
  mbid: string,
  bands: Membership[] = [],
  stron = STRON_DOMYSLNIE,
): Promise<{ items: PlayedOn[]; wiecej: boolean }> {
  const bandNames = new Map(bands.map((b) => [b.mbid, b.name]));
  const recs = await browseRecordingsOf(mbid, stron);
  const groups = new Map<string, PlayedOn>();

  /**
   * Granie wpisane przy CAŁYM WYDANIU (nie przy pojedynczych nagraniach).
   * Tak wygląda większość kredytów sesyjnych: „drums" na całej płycie. Bez tego
   * strona muzyka gubiła dokładnie te płyty, na których był tylko sesyjnym —
   * a u kogoś takiego jak Colaiuta to jest jego cały dorobek.
   */
  const zWydan = await browseReleasesOf(mbid, stron).catch(() => []);
  for (const rel of zWydan) {
    const rg = rel["release-group"];
    if (!rg) continue;
    const credit = rg["artist-credit"] ?? rel["artist-credit"] ?? [];
    if (credit.some((p) => p.artist.id === mbid)) continue; // to jego własna płyta
    const roles = (rel.relations ?? [])
      .filter((r) => r.artist?.id === mbid && PERFORMANCE_TYPES.has(r.type))
      .flatMap(rolesOf);
    if (!roles.length) continue;
    const band = credit.map((p) => bandNames.get(p.artist.id)).find(Boolean) ?? null;
    const e = groups.get(rg.id) ?? { album: normReleaseGroup(rg, rel["artist-credit"]), roles: [], trackCount: 0, withBand: band };
    for (const r of roles) if (!e.roles.includes(r)) e.roles.push(r);
    groups.set(rg.id, e);
  }

  for (const rec of recs) {
    // pomijamy nagrania, w których muzyk jest w artist credit (to jego dyskografia)
    if ((rec["artist-credit"] ?? []).some((p) => p.artist.id === mbid)) continue;
    const roles = (rec.relations ?? []).filter((r) => r.artist?.id === mbid && PERFORMANCE_TYPES.has(r.type)).flatMap(rolesOf);
    for (const rel of rec.releases ?? []) {
      const rg = rel["release-group"];
      if (!rg) continue;
      if ((rg["artist-credit"] ?? rel["artist-credit"] ?? []).some((p) => p.artist.id === mbid)) continue;
      const credit = rg["artist-credit"] ?? rel["artist-credit"] ?? [];
      const band = credit.map((p) => bandNames.get(p.artist.id)).find(Boolean) ?? null;
      const e = groups.get(rg.id) ?? { album: normReleaseGroup(rg, rel["artist-credit"]), roles: [], trackCount: 0, withBand: band };
      e.trackCount++;
      for (const r of roles) if (!e.roles.includes(r)) e.roles.push(r);
      groups.set(rg.id, e);
    }
  }
  return {
    items: [...groups.values()].sort(
      (x, y) => Number(!!x.withBand) - Number(!!y.withBand) || (y.album.firstReleaseDate ?? "").localeCompare(x.album.firstReleaseDate ?? ""),
    ),
    wiecej: recs.length >= stron * 100 || zWydan.length >= stron * 100,
  };
}

/** Podstawowe dane wielu artystów naraz (do list ulubionych) — z cache, po jednym lookupie. */
export async function getArtistSummaries(mbids: string[]) {
  const out = [];
  for (const id of mbids) {
    try {
      const a = await getArtist(id);
      out.push(a);
    } catch {
      /* pomiń */
    }
  }
  return out;
}

export function fmtLength(ms: number | null) {
  if (!ms) return "";
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ---------- kto to nagrywał ----------

/**
 * Ludzie od strony technicznej płyt: producent, realizator, miks, mastering,
 * okładka, zdjęcia.
 *
 * Do tej pory portal umiał tylko odwrotną stronę tej relacji („przy czyich
 * płytach pracował ten człowiek"), a przy zespole nie było widać, KTO im to
 * nagrał i KTO namalował okładkę — czyli tego, po czym często wybiera się
 * płytę i od czego zaczyna się kolejna podróż.
 *
 * MusicBrainz trzyma to przy WYDANIU, nie przy grupie wydawniczej, więc pytamy
 * o wydania każdej płyty osobno. Stąd twardy limit: to jedno zapytanie na
 * album (1/s), a strona i tak ładuje tę sekcję osobnym strumieniem.
 */
export interface CrewMember {
  mbid: string;
  name: string;
  roles: string[];
  albums: { mbid: string; title: string; year: string | null }[];
}

/** Role „okładkowe" — wydzielamy je, bo autor okładki to inny powód do kliknięcia. */
export const ARTWORK_ROLES = /design|illustration|art direction|graphic|photograph|artwork/i;

/**
 * Papierologia: prawa, wydawnictwo, booking, prawnicy. Formalnie to też „nie
 * granie", ale nikt nie sięga po płytę przez firmę, która trzyma copyright —
 * a wypełniało to listę tak, że producent ginął w tłumie.
 */
const PAPERWORK = /copyright|publishing|booking|legal|distribut|licens|manufact/i;

export function isCrewRole(role: string): boolean {
  return !isMusicianRole(role) && !PAPERWORK.test(role);
}

export async function albumCrew(albums: AlbumSummary[], limit = 6): Promise<CrewMember[]> {
  const wanted = albums.slice(0, limit);
  const people = new Map<string, CrewMember>();
  for (const album of wanted) {
    const data = await cached(`mb:crew:v1:${album.mbid}`, TTL.lookup, () =>
      mbFetch<{ releases: (MbRelease & { relations?: MbArtistRel[] })[] }>("/release/", {
        "release-group": album.mbid,
        inc: "artist-rels",
        limit: 1,
      }).catch(() => ({ releases: [] })),
    );
    for (const rel of data.releases ?? []) {
      for (const r of rel.relations ?? []) {
        if (!r.artist || r["target-type"] !== "artist") continue;
        const roles = rolesOf(r).filter(isCrewRole);
        if (!roles.length) continue;
        const e = people.get(r.artist.id) ?? { mbid: r.artist.id, name: r.artist.name, roles: [], albums: [] };
        for (const role of roles) if (!e.roles.includes(role)) e.roles.push(role);
        if (!e.albums.some((a) => a.mbid === album.mbid)) {
          e.albums.push({ mbid: album.mbid, title: album.title, year: album.year });
        }
        people.set(r.artist.id, e);
      }
    }
  }
  // Najpierw ci, którzy wracają na kolejnych płytach — to zwykle „ich" producent.
  return [...people.values()].sort((a, b) => b.albums.length - a.albums.length || a.name.localeCompare(b.name, "pl"));
}

// ---------- co wyprodukował ----------

/**
 * Płyty, przy których człowiek pracował przy PULPICIE: produkcja, realizacja,
 * miks, mastering, okładka.
 *
 * Po co osobno, skoro strona artysty ma już „Produkcja, realizacja, okładki":
 * tamta lista bierze relacje wiszące przy encji artysty i przy producentach
 * bywa niemal pusta — Scott Burns wyprodukował pół kanonu death metalu, a widać
 * było jedną pozycję. Producenckie kredyty MusicBrainz trzyma zwykle przy
 * WYDANIU, więc trzeba przejrzeć wydania powiązane z tym człowiekiem. Browse po
 * artyście łapie także powiązania relacyjne — to ta sama sztuczka, dzięki której
 * działa „Grał(a) na płytach".
 *
 * Zwracamy grupy wydawnicze, żeby dziesięć reedycji nie zrobiło dziesięciu
 * pozycji na liście.
 */
/**
 * Ile stron po 100 pozycji dociągamy za jednym razem.
 *
 * MusicBrainz przepuszcza jedno zapytanie na sekundę, więc każda strona to
 * sekunda czekania. Czterysta pozycji starcza na dziewięćdziesiąt dziewięć
 * procent artystów; dla Colaiuty czy Steve'a Gadda nie starczy nigdy — i od
 * tego jest przycisk „pobierz następne", zamiast karać wszystkich czekaniem.
 */
export const STRON_DOMYSLNIE = 4;

export interface ProducedAlbum {
  album: AlbumSummary;
  roles: string[];
  /** ile nagrań z tej płyty ma jego kredyt; 0 = kredyt wpisany przy całym wydaniu */
  trackCount?: number;
}

/**
 * Wydania powiązane z artystą — także RELACJAMI, nie tylko przez artist credit.
 *
 * Jedno pobranie dla dwóch pytań: „co wyprodukował" i „na czym grał". Sesyjne
 * kredyty MusicBrainz trzyma raz przy nagraniu, a raz przy CAŁYM WYDANIU:
 * Vinnie Colaiuta na „The System Has Failed" Megadeth jest wpisany przy wydaniu,
 * więc przeglądanie samych nagrań go tam nie widziało — i płyta znikała z jego
 * strony, choć na stronie płyty stał w składzie.
 */
async function browseReleasesOf(mbid: string, stron = STRON_DOMYSLNIE): Promise<(MbRelease & { relations?: MbArtistRel[] })[]> {
  return cached(`mb:rel-browse:v1:${mbid}:${stron}`, TTL.lookup, async () => {
    const out: (MbRelease & { relations?: MbArtistRel[] })[] = [];
    for (let offset = 0; offset < stron * 100; offset += 100) {
      const page = await mbFetch<{ releases: (MbRelease & { relations?: MbArtistRel[] })[]; "release-count": number }>(
        "/release/",
        { artist: mbid, limit: 100, offset, inc: "artist-rels+release-groups+artist-credits" },
      ).catch(() => null);
      if (!page) break;
      out.push(...page.releases);
      if (out.length >= page["release-count"]) break;
    }
    return out;
  });
}

/**
 * Płyty, które ktoś wyprodukował, nagrał albo zmiksował.
 *
 * DLACZEGO TO PATRZY W DWA MIEJSCA: MusicBrainz trzyma kredyty produkcyjne raz
 * przy WYDANIU („producer" na całej płycie), a raz przy KAŻDYM NAGRANIU osobno
 * („engineer" przy dwunastu kawałkach). Redaktorzy robią to jak im wygodniej
 * i oba zapisy są poprawne.
 *
 * Do niedawna przeglądaliśmy wyłącznie wydania — i tak wygląda mniejszość
 * kredytów studyjnych. Scott Burns ma w MusicBrainz ponad półtora tysiąca
 * powiązań, prawie wszystkie wpisane przy nagraniach, więc jego strona
 * pokazywała jedną płytę. Człowiek, który nagrał „Cause of Death", „Effigy of
 * the Forgotten" i pół kanonu death metalu, wyglądał u nas na kogoś, kto raz
 * pomógł przy jednej sesji.
 *
 * Nagrania grupujemy do release-group i liczymy kawałki: „engineer (14 utworów)"
 * to inna informacja niż „engineer na jednym kawałku z kompilacji".
 */
export async function getProduced(mbid: string, stron = STRON_DOMYSLNIE): Promise<{ items: ProducedAlbum[]; wiecej: boolean }> {
  const [releases, recs] = await Promise.all([
    browseReleasesOf(mbid, stron).catch(() => []),
    browseRecordingsOf(mbid, stron).catch(() => []),
  ]);

  const groups = new Map<string, ProducedAlbum>();

  // 1. Kredyt przy całym wydaniu.
  for (const rel of releases) {
    const roles = (rel.relations ?? [])
      .filter((r) => r.artist?.id === mbid)
      .flatMap(rolesOf)
      .filter(isCrewRole);
    if (!roles.length) continue;
    const rg = rel["release-group"];
    if (!rg) continue;
    const e = groups.get(rg.id) ?? { album: normReleaseGroup(rg, rel["artist-credit"]), roles: [], trackCount: 0 };
    for (const role of roles) if (!e.roles.includes(role)) e.roles.push(role);
    groups.set(rg.id, e);
  }

  // 2. Kredyt przy pojedynczych nagraniach — to jest ta brakująca większość.
  for (const rec of recs) {
    const roles = (rec.relations ?? [])
      .filter((r) => r.artist?.id === mbid)
      .flatMap(rolesOf)
      .filter(isCrewRole);
    if (!roles.length) continue;
    // Jedno nagranie wisi przy wielu wydaniach tej samej płyty (CD, winyl,
    // reedycja) — liczymy je raz na release-group, inaczej „12 utworów" robi
    // się „48 utworów".
    const widziane = new Set<string>();
    for (const rel of rec.releases ?? []) {
      const rg = rel["release-group"];
      if (!rg || widziane.has(rg.id)) continue;
      widziane.add(rg.id);
      const e = groups.get(rg.id) ?? { album: normReleaseGroup(rg, rel["artist-credit"]), roles: [], trackCount: 0 };
      e.trackCount = (e.trackCount ?? 0) + 1;
      for (const role of roles) if (!e.roles.includes(role)) e.roles.push(role);
      groups.set(rg.id, e);
    }
  }

  return {
    items: [...groups.values()].sort((x, y) =>
      (y.album.firstReleaseDate ?? "").localeCompare(x.album.firstReleaseDate ?? ""),
    ),
    // Pełna paczka = najpewniej jest jeszcze coś dalej. Nie zgadujemy więcej:
    // MusicBrainz podaje licznik, ale przy relacjach bywa mylący.
    wiecej: releases.length >= stron * 100 || recs.length >= stron * 100,
  };
}

// ---------- instrument, gdy skład go nie podaje ----------

/**
 * Czym ten człowiek zwykle gra — zgadywane z JEGO INNYCH zespołów.
 *
 * MusicBrainz trzyma instrument jako atrybut relacji „member of band", a
 * redaktorzy nagminnie zostawiają go pustym: w składzie Venomous Concept jeden
 * muzyk ma „guitar", a trzej nic. Skoro ten sam człowiek ma gdzie indziej
 * wpisane „drums", to lepsze niż puste miejsce — ale to wciąż domysł, więc
 * wołający ma go podpisać znakiem zapytania. Bębniarz może w tym akurat
 * zespole grać na harfie.
 */
export async function guessRoles(mbids: string[], skipBandMbid?: string, limit = 10): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  for (const id of mbids.slice(0, limit)) {
    const person = await getArtist(id).catch(() => null);
    if (!person) continue;
    const licznik = new Map<string, number>();
    for (const b of person.memberOf) {
      if (b.mbid === skipBandMbid) continue;
      for (const r of b.roles) licznik.set(r, (licznik.get(r) ?? 0) + 1);
    }
    const najczestsze = [...licznik.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([r]) => r);
    if (najczestsze.length) out.set(id, najczestsze);
  }
  return out;
}

/**
 * „Ta jedna płyta" zespołu — od której się zaczyna.
 *
 * Kolejność źródeł: najpierw oceny z portalu (to nasi ludzie i nasza skala
 * 1–10), a gdy jeszcze ich nie ma — ocena społeczności MusicBrainz. Przy niej
 * wymagamy kilku głosów, bo pojedyncza piątka od jednej osoby nie mówi nic.
 * Gdy nie ma nic, nie wskazujemy nic: zgadywanie „najlepszej" po dacie albo
 * długości byłoby udawaniem wiedzy.
 */
export function topAlbum(
  albums: AlbumSummary[],
  portal?: Map<string, { avg: number; count: number }>,
  minVotes = 3,
): { album: AlbumSummary; source: "portal" | "musicbrainz" } | null {
  const zPortalu = albums
    .map((a) => ({ a, r: portal?.get(a.mbid) }))
    .filter((x): x is { a: AlbumSummary; r: { avg: number; count: number } } => !!x.r && x.r.count > 0)
    .sort((x, y) => y.r.avg - x.r.avg || y.r.count - x.r.count);
  if (zPortalu.length) return { album: zPortalu[0].a, source: "portal" };

  const zMb = albums
    .filter((a) => (a.mbRating?.votes ?? 0) >= minVotes)
    .sort((x, y) => (y.mbRating!.value - x.mbRating!.value) || (y.mbRating!.votes - x.mbRating!.votes));
  return zMb.length ? { album: zMb[0], source: "musicbrainz" } : null;
}


// ---------- gdzie tego posłuchać ----------

/**
 * Adres płyty albo utworu w serwisie streamingowym — Z MUSICBRAINZ.
 *
 * Po co, skoro Spotify ma własne szukanie: bo Tidal go nie ma. Bez klucza
 * dewelopera nie da się u nich niczego rozwiązać, więc przystanek prowadził
 * zawsze do wyszukiwarki — czyli do roboty, którą człowiek musiał dokończyć
 * sam. MusicBrainz trzyma te adresy jako zwykłe relacje URL i oddaje je
 * w jednym zapytaniu, za darmo, dla obu serwisów naraz.
 *
 * Działa też dla POJEDYNCZEGO UTWORU (`recording`) — a to jedyny sposób, żeby
 * kawałek z listy otwierał się od razu, zamiast lądować w wyszukiwarce.
 */
export async function linkSerwisu(
  typ: "release-group" | "recording",
  mbid: string,
  host: RegExp,
): Promise<string | null> {
  const dane = await cached(`mb:urls:${typ}:${mbid}`, TTL.lookup, () =>
    mbFetch<{ relations?: { url?: { resource?: string } }[] }>(`/${typ}/${mbid}`, { inc: "url-rels" }),
  ).catch(() => null);
  for (const r of dane?.relations ?? []) {
    const u = r.url?.resource;
    if (u && host.test(u)) return u;
  }
  return null;
}

export const HOST_SPOTIFY = /^https:\/\/open\.spotify\.com\//i;
export const HOST_TIDAL = /^https:\/\/(listen\.)?tidal\.com\//i;
