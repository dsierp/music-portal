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
import { MbError, mbBase, mbRawFetch } from "./musicbrainz";

const TM_BASE = "https://app.ticketmaster.com/discovery/v2/events.json";
/** Adres bazy bierzemy z jednego miejsca — patrz `mbBase` (własna kopia!). */
const MB_BASE = mbBase();

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
  /**
   * Kto gra — nazwy wykonawców podane przez Ticketmastera.
   *
   * Po to, żeby dało się posłuchać PRZED wyjściem z domu: sam tytuł afisza
   * („Allegaeon x Gorod, support: Halysis") jest tekstem reklamowym i nie da
   * się z niego niczego kliknąć, a te nazwy prowadzą prosto na strony zespołów
   * w portalu.
   */
  lineup?: string[];
  /**
   * MBID wykonawców, gdy źródło je zna (MusicBrainz zna — relacja wskazuje
   * konkretnego artystę). Wtedy odnośnik prowadzi prosto na jego stronę,
   * zamiast szukać go po nazwie i ryzykować, że trafi się imiennik.
   */
  lineupIds?: Record<string, string>;
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

/**
 * Etykiety, które UZNAJEMY za „moje" przy sprawdzaniu wyników.
 *
 * Do zapytania idzie szeroki gatunek („Metal", „Rock"), bo takiego słownika
 * używa wyszukiwarka TM. Ale do filtrowania odpowiedzi szeroki „Rock" jest
 * bezużyteczny: prog rock i As December Falls to dla TM ten sam „Rock". Dlatego
 * przy każdej kategorii trzymamy listę etykiet z podgatunków — dopasowanie jest
 * po nich, a nie po korzeniu drzewa.
 */
export const TM_ACCEPT: Record<string, string[]> = {
  death: ["Metal", "Death Metal/Black Metal", "Heavy Metal", "Thrash & Speed", "Hardcore"],
  black: ["Metal", "Death Metal/Black Metal", "Heavy Metal", "Thrash & Speed"],
  other: ["Metal", "Heavy Metal", "Death Metal/Black Metal", "Thrash & Speed", "Hard Rock", "Power Metal", "Doom"],
  prog: ["Progressive Rock", "Progressive Metal", "Art Rock", "Psychedelic"],
  jazz: ["Jazz", "Jazz Blues", "Bebop", "Fusion", "Big Band", "Free Jazz", "Avant Garde"],
  punk: ["Punk", "Hardcore", "Post Punk", "Ska Punk"],
  country: ["Country", "Americana", "Bluegrass", "Alt Country"],
  classical: ["Classical", "Chamber Music", "Orchestral", "Opera"],
  electronic: ["Dance/Electronic", "Ambient Electronica", "Techno", "House", "Drum & Bass"],
  hiphop: ["Hip-Hop/Rap", "Rap"],
  pop: ["Pop", "Pop Rock", "Indie Pop"],
  folk: ["Folk", "Singer/Songwriter", "World"],
};

/** Etykiety uznawane za „moje" dla kategorii z profilu. */
export function acceptedLabels(categories: string[]): string[] {
  const out = new Set<string>();
  for (const c of categories) for (const g of TM_ACCEPT[c] ?? []) out.add(g);
  return [...out];
}

/** Nazwy gatunków TM dla listy kategorii użytkownika (bez powtórek). */
export function tmGenres(categories: string[]): string[] {
  const out = new Set<string>();
  for (const c of categories) {
    const g = TM_GENRE[c];
    if (g) out.add(g);
  }
  return [...out];
}

/**
 * Czy ten koncert w ogóle jest w moich gatunkach.
 *
 * Ticketmaster traktuje `classificationName` jak podpowiedź, nie filtr: zapytanie
 * o „Metal" wraca z Melanie Martinez (Pop) i chórem a cappella. Dlatego jeszcze
 * raz sprawdzamy TO, CO PRZYSZŁO — po etykietach z odpowiedzi, w obie strony,
 * bo TM pisze „Death Metal/Black Metal", a my prosimy o „Metal".
 *
 * Koncerty bez żadnej etykiety (MusicBrainz nie zna gatunków wydarzeń) nie są
 * odrzucane — o nich po prostu nic nie wiadomo i wołający decyduje, co z nimi
 * zrobić.
 */
export function matchesGenres(c: Concert, wanted: string[]): boolean {
  if (!wanted.length) return true;
  if (!c.genres.length) return true;
  const chce = wanted.map((g) => g.toLowerCase());
  return c.genres.some((g) => {
    const label = g.toLowerCase();
    // Tylko w jedną stronę: etykieta TM może być WĘŻSZA od tego, co uznajemy
    // („Death Metal/Black Metal" ⊂ „Metal"), ale nie odwrotnie — inaczej „Rock"
    // z listy przepuszczałby cały pop-rock, którego nikt nie chciał.
    return chce.some((w) => label === w || label.includes(w));
  });
}

/** Ma etykiety gatunków, ale żadna nie pasuje — czyli świadomie nie moje. */
export function offGenre(c: Concert, wanted: string[]): boolean {
  return wanted.length > 0 && c.genres.length > 0 && !matchesGenres(c, wanted);
}

/**
 * Zgadywany wykonawca z tytułu afisza — ostatnia deska ratunku.
 *
 * Gdy źródło nie poda składu (MusicBrainz często nie ma relacji z artystą,
 * Ticketmaster czasem nie dołącza „attractions"), zostaje sam tytuł:
 * „Innern - Tour 2026 - Kraków". Człowiek czyta z niego zespół w ćwierć
 * sekundy, więc bierzemy pierwszy człon przed myślnikiem czy dwukropkiem
 * i dajemy go jako WYSZUKANIE, nie jako pewny odnośnik — jeśli zgadliśmy
 * źle, wynik wyszukiwarki to powie, a nie pusta strona zespołu.
 */
export function zgadnijZespol(nazwa: string): string | null {
  const pierwszy = nazwa.split(/\s+[–—-]\s+|:|\s+\|\s+/)[0]?.trim() ?? "";
  const czysty = pierwszy
    .replace(/\s*\(.*?\)\s*/g, " ")
    .replace(/\b(tour|trasa|koncert|live|festival|festiwal|show|20\d\d)\b/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (czysty.length < 2 || czysty.length > 60) return null;
  return czysty;
}

export const hasTicketmasterKey = () => Boolean((process.env.TICKETMASTER_API_KEY ?? "").trim());

interface TmEvent {
  id: string;
  name: string;
  url?: string;
  dates?: { start?: { localDate?: string; localTime?: string | null } };
  classifications?: { genre?: { name?: string }; subGenre?: { name?: string } }[];
  _embedded?: {
    venues?: { name?: string; city?: { name?: string }; country?: { countryCode?: string; name?: string } }[];
    /** Wykonawcy wydarzenia — z tego bierzemy nazwy do odnalezienia ich u nas. */
    attractions?: { name?: string }[];
  };
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
      lineup: [...new Set((e._embedded?.attractions ?? []).map((a) => a.name?.trim()).filter((x): x is string => !!x))].slice(0, 4),
    };
  }).filter((c) => c.date);
}

/**
 * Koncerty w obszarze prosto z MusicBrainz — bez żadnego klucza.
 *
 * MB trzyma wydarzenia z miejscem (place → area), więc da się zapytać
 * „co gra w Krakowie do grudnia". Czego NIE da się zrobić: odsiać po gatunku,
 * bo wydarzenia nie mają tagów gatunkowych — dlatego strona pisze wprost, że
 * to wszystko, co MB wie o tym mieście, a nie wybór pod Twoje style.
 *
 * Pokrycie jest skromne: MusicBrainz to katalog nagrań, nie afisz koncertowy.
 * Traktujemy je jako darmową podstawę, którą Ticketmaster (jeśli jest klucz)
 * uzupełnia o duże sale i festiwale.
 */
/**
 * Nazwy zamienne miast — bo jedno miasto nazywa się w dwóch serwisach inaczej.
 *
 * Skąd to się wzięło: ktoś wpisuje „Kraków" i „Warszawę", a dostaje koncerty
 * tylko z Krakowa. Powód nie jest w kodzie pytającym, tylko w nazwach:
 * MusicBrainz trzyma miasta po lokalnemu („Warszawa"), Ticketmaster po
 * angielsku („Warsaw"). Jedno zapytanie z jedną pisownią trafia więc w jedno
 * źródło i mija się z drugim — a Kraków działa przypadkiem, bo po zdjęciu
 * ogonków wygląda w obu tak samo.
 *
 * Lista jest krótka i celowo: miasta, w których realnie gra się tę muzykę
 * w naszej części Europy. Nie budujemy słownika geograficznego — od tego są
 * bazy w sieci.
 */
const NAZWY_ZAMIENNE: Record<string, string[]> = {
  warszawa: ["Warsaw"],
  warsaw: ["Warszawa"],
  krakow: ["Cracow", "Kraków"],
  cracow: ["Kraków", "Krakow"],
  poznan: ["Posen", "Poznań"],
  wroclaw: ["Breslau", "Wrocław"],
  gdansk: ["Danzig", "Gdańsk"],
  praha: ["Prague", "Prag"],
  prague: ["Praha"],
  wien: ["Vienna"],
  vienna: ["Wien"],
  koln: ["Cologne", "Köln"],
  cologne: ["Köln", "Koln"],
  munchen: ["Munich", "München"],
  munich: ["München", "Munchen"],
};

/** Pisownie tego samego miasta: ta wpisana plus znane odpowiedniki. */
export function pisownie(miasto: string): string[] {
  const bez = bezOgonkow(miasto.trim());
  return [...new Set([miasto.trim(), ...(NAZWY_ZAMIENNE[bez] ?? [])])];
}

/**
 * Co się stało z JEDNYM obszarem — bo „pusto" i „nie udało się sprawdzić" to
 * dwie różne odpowiedzi, a wyglądały identycznie: obszar bez wyników po prostu
 * znikał z ekranu. Przy dwóch miastach w profilu wygląda to jak zgubione
 * miasto („mam Warszawę, ale zniknął Kraków... a był").
 */
export interface StatusObszaru {
  /** „Kraków (Poland)" albo samo „Poland" — gotowe do pokazania */
  etykieta: string;
  /** ile wydarzeń stamtąd przyszło (przed filtrem gatunków) */
  ile: number;
  /** true = zapytanie padło; wtedy `ile: 0` nie znaczy „nic nie grają" */
  blad: boolean;
}

export function etykietaObszaru(a: Area): string {
  return a.city ? `${a.city} (${a.country})` : a.country;
}

export async function concertsByAreaMb(areas: Area[]): Promise<{ items: Concert[]; statusy: StatusObszaru[] }> {
  const { from, to } = concertWindow();
  const out: Concert[] = [];
  const statusy: StatusObszaru[] = [];
  for (const area of areas.slice(0, 5)) {
    // Wszystkie pisownie naraz — jedno zapytanie, nie trzy.
    const where = area.city
      ? pisownie(area.city).map((n) => `area:"${n}"`).join(" OR ")
      : `area:"${area.country}"`;
    const url = new URL(`${MB_BASE}/event`);
    url.searchParams.set("query", `${where} AND begin:[${from} TO ${to}]`);
    url.searchParams.set("limit", "50");
    url.searchParams.set("fmt", "json");
    const key = `mb:events-area:v1:${area.country}:${area.city ?? "*"}:${from}`;
    let blad = false;
    const data = await cached<{ events?: MbEvent[] }>(key, TTL.search, async () => {
      const res = await mbRawFetch(url);
      if (!res.ok) throw new MbError(`MusicBrainz events ${res.status}`, res.status);
      return (await res.json()) as { events?: MbEvent[] };
    }).catch(() => {
      // Zadyszka MusicBrainz — zapamiętujemy ją, zamiast udawać pustkę.
      blad = true;
      return { events: [] as MbEvent[] };
    });
    const zObszaru = (data.events ?? []).filter((e) => !e.cancelled).map((e) => mbToConcert(e)).filter((c) => c.date >= from && c.date <= to);
    out.push(...zObszaru);
    statusy.push({ etykieta: etykietaObszaru(area), ile: zObszaru.length, blad });
  }
  return { items: dedupe(out), statusy };
}

/** Koncerty w moich obszarach i moich gatunkach (Ticketmaster — wymaga klucza). */
export async function concertsByArea(areas: Area[], categories: string[]): Promise<{ items: Concert[]; statusy: StatusObszaru[] }> {
  if (!areas.length || !hasTicketmasterKey()) return { items: [], statusy: [] };
  const genres = tmGenres(categories);
  const out: Concert[] = [];
  const statusy: StatusObszaru[] = [];
  for (const area of areas.slice(0, 5)) {
    const przed = out.length;
    // Bez wybranych gatunków pytamy o wszystko, co gra w okolicy.
    for (const g of (genres.length ? genres : [null]).slice(0, 4)) {
      // Ticketmaster zna miasto pod JEDNĄ nazwą i przy innej oddaje pustkę
      // bez słowa wyjaśnienia. Próbujemy po kolei i przerywamy na pierwszej,
      // która cokolwiek zwróci.
      for (const nazwa of area.city ? pisownie(area.city) : [null]) {
        const wynik = await tmSearch(nazwa === null ? area : { ...area, city: nazwa }, g).catch(() => []);
        if (wynik.length) {
          out.push(...wynik);
          break;
        }
      }
    }
    statusy.push({ etykieta: etykietaObszaru(area), ile: out.length - przed, blad: false });
  }
  return { items: dedupe(out), statusy };
}

interface MbEvent {
  id: string;
  name: string;
  "life-span"?: { begin?: string | null; end?: string | null };
  time?: string | null;
  cancelled?: boolean;
  relations?: {
    type: string;
    place?: { name?: string; area?: { name?: string } };
    url?: { resource: string };
    /** Kto gra — MusicBrainz wiesza wykonawców przy wydarzeniu jako relacje. */
    artist?: { id?: string; name?: string };
  }[];
}

/**
 * Koncerty ulubionego zespołu z MusicBrainz. Pytamy wyszukiwarką wydarzeń
 * po MBID artysty — MB nie ma osobnego „nadchodzące", więc odsiewamy datami.
 */
function mbToConcert(e: MbEvent, artist?: { mbid: string; name: string }): Concert {
  const place = e.relations?.find((r) => r.place)?.place;
  const link = e.relations?.find((r) => r.url)?.url?.resource ?? null;
  // Skład z MusicBrainz — to samo, co Ticketmaster daje w `attractions`.
  // Bez tego koncerty z MB były ślepym zaułkiem: tytuł afisza („Innern —
  // Tour 2026") nie mówi, czego się słucha, a kliknąć nie było w co.
  const grajacy = [
    ...new Set(
      (e.relations ?? [])
        .filter((r) => r.artist?.name && !/promoter|organi[sz]er|graphic|catering/i.test(r.type))
        .map((r) => r.artist!.name!.trim())
        .filter(Boolean),
    ),
  ].slice(0, 4);
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
    artistName: artist?.name,
    artistMbid: artist?.mbid,
    lineup: grajacy.length ? grajacy : undefined,
    lineupIds: grajacy.length
      ? Object.fromEntries(
          (e.relations ?? [])
            .filter((r) => r.artist?.name && r.artist?.id)
            .map((r) => [r.artist!.name!.trim(), r.artist!.id!]),
        )
      : undefined,
    genres: [],
  };
}

/**
 * Wszystkie zapowiedzi jednego zespołu: MusicBrainz + Ticketmaster.
 *
 * Sama MusicBrainz to za mało — Napalm Death gra 20 listopada w Krakowie i TM
 * o tym wie, a MB nie. Odwrotnie też się zdarza (małe kluby), więc oba źródła.
 */
export async function concertsForArtist(artist: { mbid: string; name: string }, country?: string): Promise<Concert[]> {
  const [mb, tm] = await Promise.all([
    concertsByArtist(artist).catch(() => []),
    tmByArtist(artist.name, country).catch(() => []),
  ]);
  return dedupe([...mb, ...tm]).sort((a, b) => a.date.localeCompare(b.date));
}

export async function concertsByArtist(artist: { mbid: string; name: string }): Promise<Concert[]> {
  const { from, to } = concertWindow();
  const url = new URL(`${MB_BASE}/event`);
  url.searchParams.set("query", `aid:${artist.mbid}`);
  url.searchParams.set("limit", "25");
  url.searchParams.set("fmt", "json");

  const data = await cached<{ events?: MbEvent[] }>(`mb:events:v1:${artist.mbid}:${from}`, TTL.search, async () => {
    const res = await mbRawFetch(url);
    if (!res.ok) throw new MbError(`MusicBrainz events ${res.status}`, res.status);
    return (await res.json()) as { events?: MbEvent[] };
  });

  return (data.events ?? [])
    .filter((e) => !e.cancelled)
    .map((e) => mbToConcert(e, artist))
    .filter((c) => c.date >= from && c.date <= to);
}

/**
 * Koncerty ulubionych zespołów — po jednym zapytaniu na zespół (MB: 1/s).
 * `areas` (lista „ulubieni") zawęża wynik do wskazanych miast/krajów; pusta
 * lista = pokazujemy wszystko, gdziekolwiek grają.
 */
/**
 * Koncerty konkretnego zespołu z Ticketmastera — po nazwie.
 *
 * MusicBrainz zna zapowiedzi wyjątkowo rzadko (to katalog nagrań, nie afisz),
 * więc „Twoje ulubione zespoły" świeciło pustką, choć Napalm Death gra w Polsce
 * i ma to na TM. Pytamy `keyword`, bo szukanie po `attractionId` wymagałoby
 * osobnego kroku mapowania MBID→TM.
 *
 * Keyword w TM jest luźny („Napalm" wraca z festiwalami, na których gra ktoś
 * inny), więc odsiewamy po nazwie: musi wystąpić w tytule wydarzenia.
 */
export async function tmByArtist(name: string, country?: string, size = 20): Promise<Concert[]> {
  const key = (process.env.TICKETMASTER_API_KEY ?? "").trim();
  if (!key || !name.trim()) return [];
  const { from, to } = concertWindow();
  const url = new URL(TM_BASE);
  url.searchParams.set("apikey", key);
  url.searchParams.set("keyword", name);
  if (country) url.searchParams.set("countryCode", country);
  url.searchParams.set("startDateTime", `${from}T00:00:00Z`);
  url.searchParams.set("endDateTime", `${to}T23:59:59Z`);
  url.searchParams.set("sort", "date,asc");
  url.searchParams.set("size", String(size));

  const cacheKey = `tm:artist:v1:${name.toLowerCase()}:${country ?? "*"}:${from}`;
  const data = await cached<{ _embedded?: { events?: TmEvent[] } }>(cacheKey, TTL.search, async () => {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new MbError(`Ticketmaster ${res.status}`, res.status);
    return (await res.json()) as { _embedded?: { events?: TmEvent[] } };
  });

  const szukane = name.toLowerCase();
  return (data._embedded?.events ?? [])
    .map((e) => {
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
        lineup: [...new Set((e._embedded?.attractions ?? []).map((a) => a.name?.trim()).filter((x): x is string => !!x))].slice(0, 4),
      };
    })
    .filter((c) => c.date && c.name.toLowerCase().includes(szukane));
}

export async function concertsForFavorites(
  artists: { mbid: string; name: string }[],
  areas: Area[] = [],
  max = 8,
): Promise<Concert[]> {
  const out: Concert[] = [];
  // Kraje z listy „dla ulubionych" — po nich pytamy Ticketmastera. Bez obszarów
  // pytamy raz, bez kraju: lepiej pokazać trasę po Europie niż nic.
  const kraje = [...new Set(areas.map((a) => a.country))].slice(0, 3);
  for (const a of artists.slice(0, max)) {
    // MusicBrainz zna zapowiedzi rzadko, ale gdy zna — bywają to małe kluby,
    // których nie ma na Ticketmasterze. Dlatego oba źródła, nie „albo".
    out.push(...(await concertsByArtist(a).catch(() => [])));
    for (const kraj of kraje.length ? kraje : [undefined]) {
      out.push(...(await tmByArtist(a.name, kraj).catch(() => [])));
    }
  }
  return dedupe(areas.length ? out.filter((c) => inAnyArea(c, areas)) : out);
}

/**
 * Czy koncert mieści się w którymś z obszarów.
 *
 * MusicBrainz podaje przy wydarzeniu nazwę obszaru („Kraków", „Poland"), a nie
 * kod kraju — dlatego porównujemy po nazwie, bez wielkości liter, i dla całego
 * kraju dopuszczamy też jego kod. To celowo luźne: lepiej pokazać koncert
 * z sąsiedniej dzielnicy niż zgubić właściwy.
 */
/**
 * Bez ogonków i wielkości liter: użytkownik wpisuje „Kraków", a Ticketmaster
 * zwraca „Krakow" — i przez to jego własne miasto mu nie pasowało.
 */
function bezOgonkow(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function inAnyArea(c: Concert, areas: Area[]): boolean {
  const hay = bezOgonkow([c.city, c.country, c.venue].filter(Boolean).join(" "));
  return areas.some((a) => {
    // Miasto wpisane przez człowieka ORAZ jego znane odpowiedniki: koncert
    // opisany jako „Warsaw" ma pasować do wpisanej „Warszawy" i odwrotnie.
    const igly = (a.city ? pisownie(a.city) : [a.country]).map(bezOgonkow);
    return igly.some((n) => hay.includes(n)) || (!a.city && c.country?.toLowerCase() === a.country.toLowerCase());
  });
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
