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
        res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, cache: "no-store" });
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
export interface Membership {
  mbid: string;
  name: string;
  type: string | null;
  roles: string[];
  begin: string | null;
  end: string | null;
  current: boolean;
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

/** Rola z relacji MB: "instrument" + attributes → "guitar"; "vocal" → "vocals"; inne → typ. */
function rolesOf(r: MbArtistRel): string[] {
  const attrs = (r.attributes ?? []).filter((a) => !["additional", "guest", "solo", "minor"].includes(a));
  if (r.type === "instrument") return attrs.length ? attrs : ["instrument"];
  if (r.type === "vocal") return attrs.length ? attrs : ["vocals"];
  if (r.type === "performer") return attrs.length ? attrs : ["performer"];
  if (r.type === "performing orchestra") return ["orchestra"];
  if (r.type === "conductor") return ["conductor"];
  return [r.type]; // producer, mix, mastering, engineer, recording, arranger, composer…
}
const PERFORMANCE_TYPES = new Set(["instrument", "vocal", "performer", "performing orchestra", "conductor"]);

export function isMusicianRole(role: string) {
  return !["producer", "mix", "mastering", "engineer", "recording", "editor", "design/illustration", "photography", "art direction", "graphic design", "misc", "programming", "liner notes", "phonographic copyright", "copyright", "publishing", "booking", "legal representation"].includes(role);
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
export function artistQuery(query: string, kind?: "group" | "person"): string {
  const q = lucene(query);
  if (!q) return "";
  return kind ? `${q} AND type:${kind}` : q;
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
): Promise<Pick<Artist, "mbid" | "name" | "type" | "country" | "disambiguation" | "isPerson">[]> {
  const full = artistQuery(query, kind);
  if (!full) return [];
  const data = await cached(`mb:artist-search:${full}:${limit}`, TTL.search, () =>
    mbFetch<{ artists: MbArtist[] }>("/artist/", { query: full, limit }),
  );
  return data.artists.map((a) => ({
    mbid: a.id,
    name: a.name,
    type: a.type ?? null,
    isPerson: a.type === "Person",
    country: a.country ?? null,
    disambiguation: a.disambiguation || null,
  }));
}

/** Szuka release-group po artyście i tytule (do rozwiązywania premier/best-of na MBID). */
export async function findAlbumMbid(artist: string, album: string): Promise<AlbumSummary | null> {
  const a = lucene(artist), t = lucene(album);
  if (!a || !t) return null;
  const query = `releasegroup:"${t}" AND artist:"${a}"`;
  const data = await cached(`mb:rg-find:${a}|${t}`, TTL.lookup, () =>
    mbFetch<{ "release-groups": (MbReleaseGroup & { score?: number })[] }>("/release-group/", { query, limit: 5 }),
  );
  const best = data["release-groups"].find((rg) => (rg.score ?? 0) >= 80) ?? data["release-groups"][0];
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

function normMembership(r: MbArtistRel): Membership | null {
  if (!r.artist) return null;
  return {
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
  const a = await cached(`mb:artist:${mbid}`, TTL.lookup, () =>
    mbFetch<MbArtist>(`/artist/${mbid}`, { inc: "artist-rels+release-rels+release-group-rels+url-rels+genres+tags+aliases" }),
  );
  const members: Membership[] = [];
  const memberOf: Membership[] = [];
  for (const r of a.relations ?? []) {
    if (r["target-type"] !== "artist" || r.type !== "member of band") continue;
    const m = normMembership(r);
    if (!m) continue;
    // Dla zespołu: relacja "member of band" wskazuje na członka (direction backward).
    // Dla osoby: relacja wskazuje na zespół (direction forward).
    if (r.direction === "backward") members.push(m);
    else memberOf.push(m);
  }
  const byCurrent = (x: Membership, y: Membership) => Number(y.current) - Number(x.current) || (x.begin ?? "").localeCompare(y.begin ?? "");
  members.sort(byCurrent);
  memberOf.sort(byCurrent);
  // Produkcja, realizacja, okładki — relacje przypięte do wydań.
  const workedMap = new Map<string, WorkedOn>();
  for (const r of a.relations ?? []) {
    const rel = r.release ?? r["release-group"];
    if (!rel || (r["target-type"] !== "release" && r["target-type"] !== "release_group")) continue;
    const credit = normCredit(rel["artist-credit"]);
    const relDate = ("date" in rel ? rel.date : undefined) ?? ("first-release-date" in rel ? rel["first-release-date"] : undefined) ?? null;
    const e: WorkedOn = workedMap.get(rel.id) ?? {
      releaseMbid: rel.id,
      title: rel.title,
      artistText: creditText(credit),
      date: relDate,
      roles: [],
    };
    for (const role of rolesOf(r)) if (!e.roles.includes(role)) e.roles.push(role);
    workedMap.set(rel.id, e);
  }
  const workedOn = [...workedMap.values()].sort((x, y) => (y.date ?? "").localeCompare(x.date ?? ""));

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
  };
}

/** Dyskografia (release-groups, w których artysta jest w artist credit). */
export async function getDiscography(mbid: string): Promise<AlbumSummary[]> {
  const data = await cached(`mb:rg-browse:${mbid}`, TTL.lookup, async () => {
    const out: MbReleaseGroup[] = [];
    for (let offset = 0; offset < 300; offset += 100) {
      const page = await mbFetch<{ "release-groups": MbReleaseGroup[]; "release-group-count": number }>("/release-group/", {
        artist: mbid, limit: 100, offset, inc: "artist-credits",
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
 * Płyty, na których muzyk grał (relacje wykonawca↔nagranie), a nie jest głównym wykonawcą.
 * To jest silnik "podróży": z płyty do muzyka, z muzyka do innych płyt.
 */
export async function getPlayedOn(mbid: string, bands: Membership[] = []): Promise<PlayedOn[]> {
  const bandNames = new Map(bands.map((b) => [b.mbid, b.name]));
  const recs = await cached(`mb:rec-browse:${mbid}`, TTL.lookup, async () => {
    const out: MbRecording[] = [];
    for (let offset = 0; offset < 500; offset += 100) {
      const page = await mbFetch<{ recordings: MbRecording[]; "recording-count": number }>("/recording/", {
        artist: mbid, limit: 100, offset, inc: "releases+release-groups+artist-credits+artist-rels",
      });
      out.push(...page.recordings);
      if (out.length >= page["recording-count"]) break;
    }
    return out;
  });
  const groups = new Map<string, PlayedOn>();
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
  return [...groups.values()].sort(
    (x, y) => Number(!!x.withBand) - Number(!!y.withBand) || (y.album.firstReleaseDate ?? "").localeCompare(x.album.firstReleaseDate ?? ""),
  );
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
