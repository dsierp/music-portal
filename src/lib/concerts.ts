/**
 * Koncerty — „co gra u mnie w okolicy w najbliższych trzech miesiącach".
 *
 * Dwa źródła, świadomie różne:
 *
 *  1. TICKETMASTER (Discovery API) — pytamy po OBSZARZE (miasto albo kraj),
 *     gatunku i zakresie dat. To jedyne z dostępnych źródeł, które potrafi
 *     odpowiedzieć na pytanie „metal w Warszawie do końca listopada". Zna
 *     głównie duże sale i festiwale; małe kluby bywają poza jego zasięgiem
 *     i nie ma sensu udawać, że jest inaczej.
 *
 *  2. MUSICBRAINZ (encja `event`) — pytamy po ARTYŚCIE, dla ulubionych
 *     zespołów. Danych o przyszłych koncertach ma mało, ale są darmowe,
 *     bez klucza i czasem trafia się trasa, której Ticketmaster nie sprzedaje.
 *
 * Wynik obu źródeł sprowadzamy do jednego kształtu (`Concert`) i scalamy,
 * bo z punktu widzenia czytelnika to jest jedna lista.
 *
 * Bez `TICKETMASTER_API_KEY` część „po obszarze" po prostu nie działa —
 * strona mówi wtedy wprost, czego brakuje, zamiast udawać pustkę.
 */
import { cached, TTL } from "./cache";
import { MbError } from "./musicbrainz";

const TM_BASE = "https://app.ticketmaster.com/discovery/v2/events.json";
const MB_BASE = "https://musicbrainz.org/ws/2";

export interface Concert {
  id: string;
  name: string;
  /** ISO date (YYYY-MM-DD) — po tym sortujemy i filtrujemy okno 3 miesięcy. */
  date: string;
  time: string | null;
  city: string | null;
  country: string | null;
  venue: string | null;
  url: string | null;
  source: "ticketmaster" | "musicbrainz";
  /** Który zespół z ulubionych to wywołał (jeśli szukaliśmy po artyście). */
  artistName?: string;
  artistMbid?: string;
  genres: string[];
}

export interface Area {
  country: string;
  city: string | null;
}

/** Okno „najbliższe 3 miesiące" — od dziś do dziś+3 miesiące (ISO, bez czasu). */
export function concertWindow(now = new Date()): { from: string; to: string } {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const to = new Date(from);
  to.setUTCMonth(to.getUTCMonth() + 3);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

/**
 * Kategoria z profilu → nazwa gatunku, którą rozumie Ticketmaster.
 * TM ma własny słownik („Metal", „Hard Rock", „Jazz"…), więc mapujemy ręcznie.
 * Kategorie bez sensownego odpowiednika oddajemy jako „Rock" albo pomijamy.
 */
export const TM_GENRE: Record<string, string | null> = {
  death: "Metal",
  black: "Metal",
  other: "Metal",
  prog: "Rock",
  jazz: "Jazz",
  punk: "Punk",
  country: "Country",
  classical: "Classical",
  electronic: "Dance/Electronic",
  hiphop: "Hip-Hop/Rap",
  pop: "Pop",
  folk: "Folk",
};

/** Nazwy gatunków TM dla listy kategorii użytkownika (bez powtórek). */
export function tmGenres(categories: string[]): string[] {
  const out = new Set<string>();
  for (const c of categories) {
    const g = TM_GENRE[c];
    if (g) out.add(g);
  }
  return [...out];
}

export const hasTicketmasterKey = () => Boolean((process.env.TICKETMASTER_API_KEY ?? "").trim());

interface TmEvent {
  id: string;
  name: string;
  url?: string;
  dates?: { start?: { localDate?: string; localTime?: string | null } };
  classifications?: { genre?: { name?: string }; subGenre?: { name?: string } }[];
  _embedded?: { venues?: { name?: string; city?: { name?: string }; country?: { countryCode?: string; name?: string } }[] };
}

/**
 * Koncerty z Ticketmastera dla jednego obszaru i jednego gatunku.
 * Jedno zapytanie = jedna kombinacja, więc strona pyta o iloczyn obszarów
 * i gatunków — przy kilku pozycjach to kilka zapytań, wszystkie z cache'em.
 */
async function tmSearch(area: Area, genre: string | null, size = 40): Promise<Concert[]> {
  const key = (process.env.TICKETMASTER_API_KEY ?? "").trim();
  if (!key) return [];
  const { from, to } = concertWindow();
  const url = new URL(TM_BASE);
  url.searchParams.set("apikey", key);
  url.searchParams.set("countryCode", area.country);
  if (area.city) url.searchParams.set("city", area.city);
  if (genre) url.searchParams.set("classificationName", genre);
  url.searchParams.set("startDateTime", `${from}T00:00:00Z`);
  url.searchParams.set("endDateTime", `${to}T23:59:59Z`);
  url.searchParams.set("sort", "date,asc");
  url.searchParams.set("size", String(size));

  // Klucz cache'u BEZ apikey — inaczej rotacja klucza unieważniałaby cały cache
  // (i klucz lądowałby w bazie, czego nie chcemy).
  const cacheKey = `tm:v1:${area.country}:${area.city ?? "*"}:${genre ?? "*"}:${from}`;
  const data = await cached<{ _embedded?: { events?: TmEvent[] } }>(cacheKey, TTL.search, async () => {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      const why = await res.text().then((t) => t.slice(0, 200)).catch(() => "");
      throw new MbError(`Ticketmaster ${res.status}${why ? ` — ${why}` : ""}`, res.status);
    }
    return (await res.json()) as { _embedded?: { events?: TmEvent[] } };
  });

  return (data._embedded?.events ?? []).map((e) => {
    const v = e._embedded?.venues?.[0];
    return {
      id: `tm:${e.id}`,
      name: e.name,
      date: e.dates?.start?.localDate ?? "",
      time: e.dates?.start?.localTime ?? null,
      city: v?.city?.name ?? null,
      country: v?.country?.countryCode ?? v?.country?.name ?? null,
      venue: v?.name ?? null,
      url: e.url ?? null,
      source: "ticketmaster" as const,
      genres: [...new Set((e.classifications ?? []).flatMap((c) => [c.genre?.name, c.subGenre?.name]).filter((x): x is string => Boolean(x) && x !== "Undefined"))],
    };
  }).filter((c) => c.date);
}

/** Koncerty w moich obszarach i moich gatunkach. */
export async function concertsByArea(areas: Area[], categories: string[]): Promise<Concert[]> {
  if (!areas.length || !hasTicketmasterKey()) return [];
  const genres = tmGenres(categories);
  const out: Concert[] = [];
  for (const area of areas.slice(0, 5)) {
    // Bez wybranych gatunków pytamy o wszystko, co gra w okolicy.
    for (const g of (genres.length ? genres : [null]).slice(0, 4)) {
      out.push(...(await tmSearch(area, g).catch(() => [])));
    }
  }
  return dedupe(out);
}

interface MbEvent {
  id: string;
  name: string;
  "life-span"?: { begin?: string | null; end?: string | null };
  time?: string | null;
  cancelled?: boolean;
  relations?: { type: string; place?: { name?: string; area?: { name?: string } }; url?: { resource: string } }[];
}

/**
 * Koncerty ulubionego zespołu z MusicBrainz. Pytamy wyszukiwarką wydarzeń
 * po MBID artysty — MB nie ma osobnego „nadchodzące", więc odsiewamy datami.
 */
export async function concertsByArtist(artist: { mbid: string; name: string }): Promise<Concert[]> {
  const { from, to } = concertWindow();
  const url = new URL(`${MB_BASE}/event`);
  url.searchParams.set("query", `aid:${artist.mbid}`);
  url.searchParams.set("limit", "25");
  url.searchParams.set("fmt", "json");

  const data = await cached<{ events?: MbEvent[] }>(`mb:events:v1:${artist.mbid}:${from}`, TTL.search, async () => {
    const res = await fetch(url, {
      headers: { "User-Agent": (process.env.MUSICBRAINZ_USER_AGENT || "PureNewShit/0.1 ( https://music-travel.app )").trim(), Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) throw new MbError(`MusicBrainz events ${res.status}`, res.status);
    return (await res.json()) as { events?: MbEvent[] };
  });

  return (data.events ?? [])
    .filter((e) => !e.cancelled)
    .map((e) => {
      const place = e.relations?.find((r) => r.place)?.place;
      const link = e.relations?.find((r) => r.url)?.url?.resource ?? null;
      return {
        id: `mb:${e.id}`,
        name: e.name,
        date: e["life-span"]?.begin ?? "",
        time: e.time ?? null,
        city: place?.area?.name ?? null,
        country: null,
        venue: place?.name ?? null,
        url: link ?? `https://musicbrainz.org/event/${e.id}`,
        source: "musicbrainz" as const,
        artistName: artist.name,
        artistMbid: artist.mbid,
        genres: [],
      };
    })
    .filter((c) => c.date >= from && c.date <= to);
}

/** Koncerty ulubionych zespołów — po jednym zapytaniu na zespół (MB: 1/s). */
export async function concertsForFavorites(artists: { mbid: string; name: string }[], max = 8): Promise<Concert[]> {
  const out: Concert[] = [];
  for (const a of artists.slice(0, max)) {
    out.push(...(await concertsByArtist(a).catch(() => [])));
  }
  return dedupe(out);
}

/** Ten sam koncert potrafi przyjść z obu źródeł — zostawiamy jeden. */
export function dedupe(list: Concert[]): Concert[] {
  const seen = new Set<string>();
  return list
    .filter((c) => {
      const key = `${c.date}|${(c.venue ?? c.city ?? "").toLowerCase()}|${c.name.toLowerCase().slice(0, 40)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name, "pl"));
}
