/**
 * Spotify od strony KONKRETNEGO użytkownika.
 *
 * Wszystko tutaj dzieje się w jego imieniu i tylko za jego zgodą: token bierze
 * się z tego, że sam kliknął „Połącz ze Spotify", i leży w tabeli `account`
 * obok tokenów logowania. Nikt nie łączy się z cudzym kontem, a bez połączenia
 * funkcje po prostu nie istnieją — nie ma tu żadnego konta wspólnego portalu.
 *
 * Zakresy trzymamy minimalne: odczyt tego, co akurat leci, i tworzenie
 * PRYWATNYCH playlist. Żadnego sterowania odtwarzaniem, żadnego czytania
 * biblioteki, żadnych danych o innych ludziach.
 */
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { cached, cacheHasNote, cacheNote } from "./cache";

const API = "https://api.spotify.com/v1";
const TOKEN_URL = "https://accounts.spotify.com/api/token";

/**
 * Ruch do Spotify puszczamy pojedynczo i z odstępem.
 *
 * Powód z życia: strona podróży rozwiązywała adresy wszystkich płyt naraz
 * (Promise.all), więc do Spotify szło kilkanaście zapytań w tej samej chwili.
 * Odpowiedź to 429 z „QUOTA_EXCEEDED" — i to na WSZYSTKO, także na kolejne
 * strony, przez co wyglądało, jakby szukanie nie działało w ogóle. Limit liczy
 * się w krótkim oknie, więc lekarstwem jest szereg, nie większy limit.
 */
const ODSTEP_MS = 120;
let ogonek: Promise<unknown> = Promise.resolve();
/** Do kiedy nie zaczepiamy Spotify (ustawiane po 429, wg Retry-After). */
let pauzaDo = 0;

function wKolejce<T>(zadanie: () => Promise<T>): Promise<T> {
  const moje = ogonek.then(async () => {
    await new Promise((r) => setTimeout(r, ODSTEP_MS));
    return zadanie();
  });
  // Ogon nie może się przerwać na błędzie, bo wtedy kolejka staje na zawsze.
  ogonek = moje.catch(() => {});
  return moje;
}

/** Po 429 odczekujemy tyle, ile każe Spotify (a gdy nie powie — minutę). */
function zapamietajPauze(res: Response) {
  const ile = Number(res.headers.get("retry-after") ?? "");
  pauzaDo = Date.now() + (Number.isFinite(ile) && ile > 0 ? ile * 1000 : 60_000);
}

function wPauzie(): boolean {
  return Date.now() < pauzaDo;
}

/** Zakresy, o które prosimy przy łączeniu konta — patrz komentarz u góry. */
export const SPOTIFY_SCOPES = ["user-read-currently-playing", "playlist-modify-private"].join(" ");

export function spotifyConfigured(): boolean {
  return !!process.env.SPOTIFY_CLIENT_ID && !!process.env.SPOTIFY_CLIENT_SECRET;
}

interface Konto {
  access_token: string | null;
  refresh_token: string | null;
  expires_at: number | null;
  providerAccountId: string;
}

async function kontoSpotify(userId: string): Promise<Konto | null> {
  const row = await db.query.accounts.findFirst({
    where: and(eq(schema.accounts.userId, userId), eq(schema.accounts.provider, "spotify")),
    columns: { access_token: true, refresh_token: true, expires_at: true, providerAccountId: true },
  });
  return row ?? null;
}

/** Czy ten użytkownik podłączył Spotify (do pokazania przycisku „Połącz"). */
export async function spotifyConnected(userId: string): Promise<boolean> {
  if (await spotifyBlocked(userId)) return false;
  return !!(await kontoSpotify(userId).catch(() => null));
}

/**
 * Ważny token dostępu, w razie potrzeby odświeżony.
 *
 * Spotify wydaje tokeny na godzinę, a sesja w portalu trwa tygodniami — więc
 * odświeżanie musi być tutaj, nie przy logowaniu. Nowy token od razu wraca do
 * bazy: inaczej każde wejście na stronę główną odświeżałoby go od nowa.
 */
async function tokenDla(userId: string): Promise<string | null> {
  const konto = await kontoSpotify(userId).catch(() => null);
  if (!konto) return null;
  const zapas = 60; // sekundy — nie chcemy trafić w moment wygaśnięcia
  const wazny = konto.expires_at && konto.expires_at - zapas > Math.floor(Date.now() / 1000);
  if (wazny && konto.access_token) return konto.access_token;
  if (!konto.refresh_token || !spotifyConfigured()) return konto.access_token ?? null;

  const basic = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: konto.refresh_token }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const dane = (await res.json()) as { access_token?: string; expires_in?: number; refresh_token?: string };
  if (!dane.access_token) return null;
  await db
    .update(schema.accounts)
    .set({
      access_token: dane.access_token,
      expires_at: Math.floor(Date.now() / 1000) + (dane.expires_in ?? 3600),
      // Spotify czasem podmienia refresh token; gdy go nie przyśle, stary zostaje ważny.
      ...(dane.refresh_token ? { refresh_token: dane.refresh_token } : {}),
    })
    .where(and(eq(schema.accounts.userId, userId), eq(schema.accounts.provider, "spotify")));
  return dane.access_token;
}

/**
 * Odmowa dla konkretnego konta. Nowa aplikacja Spotify chodzi w trybie
 * deweloperskim i obsługuje tylko osoby dopisane ręcznie przez właściciela —
 * reszcie odpowiada 403. To nie jest awaria portalu i nie ma o tym krzyczeć:
 * zapamiętujemy odmowę na godzinę i po prostu chowamy funkcje Spotify przed tą
 * osobą. Godzina, bo dopisanie kogoś do listy ma zadziałać bez czekania do
 * jutra.
 */
const BLOKADA_TTL = 60 * 60;
const kluczBlokady = (userId: string) => `spotify:odmowa:${userId}`;

/** Czy Spotify odmawia obsługi tego konta (a więc: chowamy przyciski). */
export async function spotifyBlocked(userId: string): Promise<boolean> {
  return cacheHasNote(kluczBlokady(userId));
}

async function api<T>(userId: string, sciezka: string, init?: RequestInit): Promise<T | null> {
  const token = await tokenDla(userId);
  if (!token) return null;
  if (wPauzie()) return null;
  const res = await wKolejce(() =>
    fetch(`${API}${sciezka}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
      cache: "no-store",
    }),
  );
  // 429 to nasz nadmiar, nie odmowa dla tego konta — nie chowamy funkcji,
  // tylko na chwilę milkniemy.
  if (res.status === 429) {
    zapamietajPauze(res);
    return null;
  }
  if (res.status === 403 || res.status === 401) {
    await cacheNote(kluczBlokady(userId), BLOKADA_TTL);
    return null;
  }
  if (res.status === 204 || res.status === 202) return null; // „nic teraz nie gra"
  if (!res.ok) return null;
  const tekst = await res.text();
  return tekst ? (JSON.parse(tekst) as T) : null;
}

// ---------- co teraz gra ----------

export interface NowPlaying {
  title: string;
  artist: string;
  album: string;
  url: string;
  cover: string | null;
  playing: boolean;
}

interface SpTrack {
  name: string;
  uri: string;
  external_urls?: { spotify?: string };
  artists?: { name: string }[];
  album?: { name: string; images?: { url: string }[] };
}

/**
 * Utwór odtwarzany w tej chwili. `null` znaczy „nic nie leci albo nie wiemy" —
 * i to jest normalny stan, nie awaria, więc kafelek po prostu się nie pokazuje.
 */
export async function nowPlaying(userId: string): Promise<NowPlaying | null> {
  const dane = await api<{ is_playing?: boolean; item?: SpTrack }>(userId, "/me/player/currently-playing").catch(() => null);
  const item = dane?.item;
  if (!item?.name) return null;
  return {
    title: item.name,
    artist: (item.artists ?? []).map((a) => a.name).join(", "),
    album: item.album?.name ?? "",
    url: item.external_urls?.spotify ?? "",
    cover: item.album?.images?.[item.album.images.length - 1]?.url ?? null,
    playing: dane?.is_playing !== false,
  };
}

// ---------- podróż → playlista ----------

/** „Artysta – Tytuł" z etykiety przystanku; bez myślnika bierzemy całość jako tytuł. */
export function rozbijEtykiete(label: string): { artist: string; title: string } {
  const [a, ...reszta] = label.split(/\s+[–—-]\s+/);
  return reszta.length ? { artist: a.trim(), title: reszta.join(" – ").trim() } : { artist: "", title: label.trim() };
}

/**
 * Zapytanie do wyszukiwarki Spotify.
 *
 * Wartości MUSZĄ być w cudzysłowie: bez niego `album:Exercises in Futility`
 * znaczy dla Spotify „album o tytule Exercises" plus luźne słowa, więc nic nie
 * pasuje. Na tym poległa cała wysyłka podróży — wynik brzmiał „nie udało się
 * dopasować żadnej płyty", choć płyty były w katalogu.
 */
export function zapytanieOAlbum(artist: string, title: string): string {
  const czysty = (v: string) => v.replace(/["']/g, " ").replace(/\s+/g, " ").trim();
  const t = czysty(title);
  const a = czysty(artist);
  if (!t) return a;
  return a ? `album:"${t}" artist:"${a}"` : `album:"${t}"`;
}

async function znajdzAlbum(userId: string, artist: string, title: string): Promise<string | null> {
  const szukaj = async (q: string) => {
    if (!q) return null;
    const dane = await api<{ albums?: { items?: { id: string }[] } }>(
      userId,
      `/search?type=album&limit=1&q=${encodeURIComponent(q)}`,
    ).catch(() => null);
    return dane?.albums?.items?.[0]?.id ?? null;
  };
  // Najpierw dokładnie po polach, a gdy nic — luźno całą etykietą. Tytuły bywają
  // zapisane inaczej po obu stronach (podtytuły, znaki diakrytyczne), a wtedy
  // zwykłe szukanie po całości trafia lepiej niż filtr pola.
  return (await szukaj(zapytanieOAlbum(artist, title))) ?? (await szukaj([artist, title].filter(Boolean).join(" ")));
}

async function utworyAlbumu(userId: string, albumId: string): Promise<string[]> {
  const dane = await api<{ items?: { uri: string }[] }>(userId, `/albums/${albumId}/tracks?limit=50`).catch(() => null);
  return (dane?.items ?? []).map((t) => t.uri).filter(Boolean);
}

/**
 * To samo szukanie, co przy wysyłce, ale ze stanem po drodze — do diagnostyki.
 * Zwraca zapytania i to, ile pozycji wróciło, żeby dało się zobaczyć, na czym
 * dokładnie się wykłada, zamiast zgadywać z komunikatu „nic nie znaleziono".
 */
export async function szukajAlbumuDiag(userId: string, artist: string, title: string) {
  const proba = async (q: string) => {
    const dane = await api<{ albums?: { items?: { id: string; name: string; artists?: { name: string }[] }[] } }>(
      userId,
      `/search?type=album&limit=3&q=${encodeURIComponent(q)}`,
    ).catch((e) => ({ blad: e instanceof Error ? e.message : String(e) }) as never);
    const items = (dane as { albums?: { items?: { id: string; name: string; artists?: { name: string }[] }[] } })?.albums?.items ?? [];
    return {
      zapytanie: q,
      ile: items.length,
      pierwsze: items[0] ? `${(items[0].artists ?? []).map((a) => a.name).join(", ")} – ${items[0].name}` : null,
      odpowiedzPusta: dane === null,
    };
  };
  return {
    rozbicie: { artist, title },
    poPolach: await proba(zapytanieOAlbum(artist, title)),
    luzno: await proba([artist, title].filter(Boolean).join(" ")),
  };
}

export interface WynikWysylki {
  url: string | null;
  dodane: number;
  /** Przystanki, których nie dało się przenieść — z powodem, po ludzku. */
  pominiete: { label: string; powod: "typ" | "nieznaleziono" }[];
}

/**
 * Podróż jako prywatna playlista na koncie użytkownika.
 *
 * Playlista Spotify to lista UTWORÓW, a przystanek bywa zespołem albo
 * koncertem — te pomijamy świadomie i mówimy o tym wprost, zamiast dosypywać
 * „trzy najpopularniejsze kawałki", bo wtedy o zawartości decydowałoby Spotify,
 * a nie autor podróży. Płyta wchodzi w całości, w kolejności z wydawnictwa.
 */
export async function journeyToPlaylist(
  userId: string,
  podroz: { title: string; description?: string | null },
  przystanki: { targetType: "ALBUM" | "ARTIST" | "CONCERT"; label: string }[],
): Promise<WynikWysylki | null> {
  const ja = await api<{ id: string }>(userId, "/me").catch(() => null);
  if (!ja?.id) return null;

  const uris: string[] = [];
  const pominiete: WynikWysylki["pominiete"] = [];
  for (const p of przystanki) {
    if (p.targetType !== "ALBUM") {
      pominiete.push({ label: p.label, powod: "typ" });
      continue;
    }
    const { artist, title } = rozbijEtykiete(p.label);
    // Szukamy tokenem aplikacji — to samo dopasowanie, co przy linkach, więc
    // playlista i odnośniki na stronie zawsze pokazują tę samą płytę.
    const albumId = (await spotifyFindAlbum(artist, title))?.id ?? (await znajdzAlbum(userId, artist, title));
    if (!albumId) {
      pominiete.push({ label: p.label, powod: "nieznaleziono" });
      continue;
    }
    uris.push(...(await utworyAlbumu(userId, albumId)));
  }
  if (!uris.length) return { url: null, dodane: 0, pominiete };

  const playlista = await api<{ id: string; external_urls?: { spotify?: string } }>(userId, `/users/${ja.id}/playlists`, {
    method: "POST",
    body: JSON.stringify({
      name: podroz.title,
      description: (podroz.description ?? "").slice(0, 300),
      public: false,
    }),
  });
  if (!playlista?.id) return null;

  // Spotify przyjmuje najwyżej sto utworów naraz, a płyta to bywa dwadzieścia.
  for (let i = 0; i < uris.length; i += 100) {
    await api(userId, `/playlists/${playlista.id}/tracks`, {
      method: "POST",
      body: JSON.stringify({ uris: uris.slice(i, i + 100) }),
    });
  }
  return { url: playlista.external_urls?.spotify ?? null, dodane: uris.length, pominiete };
}

// ---------- katalog: dyskografia bez udziału użytkownika ----------

/** Skasowanie wpisu z bufora — patrz komentarz przy `spotifyFindAlbum`. */
async function zapomnij(klucz: string) {
  const { cacheForget } = await import("./cache");
  await cacheForget(klucz).catch(() => {});
}

/**
 * Token samej aplikacji (client credentials).
 *
 * Do czytania katalogu nie potrzeba niczyjego konta — i dobrze, bo dzięki temu
 * łatanie dyskografii działa dla każdego odwiedzającego, także niezalogowanego,
 * i nie dotyczy go limit pięciu osób z trybu deweloperskiego.
 */
let tokenWPamieci: { wartosc: string; do: number } | null = null;

async function tokenAplikacji(): Promise<string | null> {
  if (!spotifyConfigured()) return null;
  // Świadomie BEZ bufora w bazie: `cached` zapisuje także wynik nieudany, więc
  // jedna chwilowa awaria Spotify unieruchamiałaby katalog na godzinę. Token
  // trzymamy w pamięci procesu — tanio, a nieudana próba nie zostawia śladu.
  if (tokenWPamieci && tokenWPamieci.do > Date.now()) return tokenWPamieci.wartosc;
  const pobierz = async () => {
    const basic = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64");
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "client_credentials" }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const dane = (await res.json()) as { access_token?: string };
    return dane.access_token ?? null;
  };
  const token = await pobierz().catch(() => null);
  if (token) tokenWPamieci = { wartosc: token, do: Date.now() + 55 * 60 * 1000 };
  return token;
}

async function katalog<T>(sciezka: string): Promise<T | null> {
  const token = await tokenAplikacji();
  if (!token) return null;
  if (wPauzie()) return null;
  const res = await wKolejce(() =>
    fetch(`${API}${sciezka}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }),
  );
  if (res.status === 429) {
    zapamietajPauze(res);
    return null;
  }
  if (!res.ok) return null;
  return (await res.json()) as T;
}

export interface SpotifyAlbum {
  id: string;
  title: string;
  year: string | null;
  artists: string;
  url: string;
  cover: string | null;
  /** „album" = pod jego nazwiskiem, „appears_on" = zagrał u kogoś */
  group: "album" | "appears_on";
}

interface SpAlbumRaw {
  id: string;
  name: string;
  release_date?: string;
  album_group?: string;
  external_urls?: { spotify?: string };
  images?: { url: string }[];
  artists?: { name: string }[];
}

/**
 * Dopasowanie artysty po nazwie.
 *
 * MusicBrainz rzadko trzyma link do Spotify przy samym artyście, więc zwykle
 * zostaje nazwa — a ta bywa niejednoznaczna. Bierzemy wyłącznie DOKŁADNE
 * trafienie (bez względu na wielkość liter): lepiej nie pokazać nic, niż
 * dopisać komuś cudzą dyskografię.
 */
async function idArtysty(name: string, spotifyLink?: string): Promise<string | null> {
  const zLinku = spotifyLink?.match(/artist\/([A-Za-z0-9]+)/)?.[1];
  if (zLinku) return zLinku;
  const dane = await katalog<{ artists?: { items?: { id: string; name: string }[] } }>(
    `/search?type=artist&limit=5&q=${encodeURIComponent(name)}`,
  );
  const trafienie = (dane?.artists?.items ?? []).find((a) => a.name.toLowerCase() === name.toLowerCase());
  return trafienie?.id ?? null;
}

/**
 * Dyskografia ze Spotify — jako ŁATKA na dziury w MusicBrainz, nie zamiennik.
 *
 * Spotify jest katalogiem wydawniczym, więc wie, co wyszło, także przy mniejszych
 * wytwórniach i poza anglosaskim światem (stąd trafia tam np. polski jazz, którego
 * w MusicBrainz nikt nie wpisał). Nie wie za to nic o składach, producentach ani
 * datach członkostwa — te zostają przy MusicBrainz.
 */
export async function spotifyDiscography(name: string, spotifyLink?: string): Promise<SpotifyAlbum[]> {
  if (!spotifyConfigured() || !name) return [];
  return cached(`spotify:disco:v1:${name.toLowerCase()}`, 60 * 60 * 24, async () => {
    const id = await idArtysty(name, spotifyLink);
    if (!id) return [] as SpotifyAlbum[];
    const dane = await katalog<{ items?: SpAlbumRaw[] }>(
      `/artists/${id}/albums?include_groups=album,appears_on&limit=50&market=PL`,
    );
    return (dane?.items ?? []).map((a) => ({
      id: a.id,
      title: a.name,
      year: a.release_date ? a.release_date.slice(0, 4) : null,
      artists: (a.artists ?? []).map((x) => x.name).join(", "),
      url: a.external_urls?.spotify ?? `https://open.spotify.com/album/${a.id}`,
      cover: a.images?.[a.images.length - 1]?.url ?? null,
      group: a.album_group === "appears_on" ? ("appears_on" as const) : ("album" as const),
    }));
  }).catch(() => []);
}

/**
 * Adres płyty w Spotify — prosto na album, nie do wyszukiwarki.
 *
 * Dotąd linki prowadziły na `/search/<tekst>`, więc nigdy nie trafiały w płytę,
 * tylko w listę wyników (a przy etykiecie z myślnikiem — w wyniki bez sensu).
 * Tu pytamy katalog TOKENEM APLIKACJI: bez logowania kogokolwiek, więc działa
 * dla każdego odwiedzającego i wynik da się trzymać w buforze na tydzień.
 */
export async function spotifyAlbumUrl(artist: string, title: string): Promise<string | null> {
  const znaleziony = await spotifyFindAlbum(artist, title);
  return znaleziony?.url ?? null;
}

export async function spotifyFindAlbum(
  artist: string,
  title: string,
): Promise<{ id: string; url: string; title: string; artists: string } | null> {
  if (!spotifyConfigured() || !title) return null;
  const klucz = `spotify:album:v1:${artist.toLowerCase()}|${title.toLowerCase()}`;
  const znalezione = await cached(klucz, 60 * 60 * 24 * 7, async () => {
    const proba = async (q: string) => {
      const dane = await katalog<{ albums?: { items?: SpAlbumRaw[] } }>(
        `/search?type=album&limit=5&q=${encodeURIComponent(q)}`,
      );
      return dane?.albums?.items ?? [];
    };
    // Najpierw po polach (precyzyjnie), potem luźno — tytuły bywają zapisane
    // inaczej po obu stronach, a wtedy filtr pola nie trafia, a zwykłe szukanie
    // owszem.
    let items = await proba(zapytanieOAlbum(artist, title));
    if (!items.length) items = await proba([artist, title].filter(Boolean).join(" "));
    // Bierzemy pierwsze trafienie o zgodnym tytule; gdy takiego nie ma —
    // pierwsze z brzegu jest gorsze niż nic, bo prowadziłoby na obcą płytę.
    const chce = kluczTytulu(title);
    const traf = items.find((a) => kluczTytulu(a.name) === chce) ?? null;
    if (!traf) return null;
    return {
      id: traf.id,
      url: traf.external_urls?.spotify ?? `https://open.spotify.com/album/${traf.id}`,
      title: traf.name,
      artists: (traf.artists ?? []).map((x) => x.name).join(", "),
    };
  }).catch(() => null);
  // Brak dopasowania NIE zostaje w buforze: inaczej jedna nieudana próba (np.
  // gdy Spotify chwilowo odmówił) trzymałaby pustkę przez tydzień.
  if (!znalezione) await zapomnij(klucz);
  return znalezione;
}

/**
 * Surowa sonda szukania — bez żadnego przetwarzania po drodze.
 *
 * Dotychczasowa diagnostyka mówiła tylko „odpowiedź pusta", a to zlepek dwóch
 * różnych rzeczy: zero wyników i odmowa Spotify. Tu wychodzi status HTTP i
 * początek treści, więc widać, KTÓRA to.
 */
export async function spotifySondaSzukania(userId: string | null, q: string) {
  const wynik = async (res: Response) => {
    const tresc = await res.text();
    let ile: number | null = null;
    try {
      ile = (JSON.parse(tresc) as { albums?: { items?: unknown[] } })?.albums?.items?.length ?? null;
    } catch {
      /* nie JSON — wtedy liczy się sam fragment */
    }
    return { status: res.status, ok: res.ok, ile, fragment: tresc.slice(0, 300) };
  };
  const sciezka = `/search?type=album&limit=3&q=${encodeURIComponent(q)}`;
  const out: Record<string, unknown> = { zapytanie: q };

  const app = await tokenAplikacji().catch(() => null);
  out.tokenAplikacji = app ? `jest (${app.length} zn.)` : "brak";
  if (app) {
    out.aplikacja = await fetch(`${API}${sciezka}`, {
      headers: { Authorization: `Bearer ${app}` },
      cache: "no-store",
    })
      .then(wynik)
      .catch((e) => ({ blad: e instanceof Error ? e.message : String(e) }));
  }

  if (userId) {
    const uz = await tokenDla(userId).catch(() => null);
    out.tokenUzytkownika = uz ? `jest (${uz.length} zn.)` : "brak";
    if (uz) {
      out.uzytkownik = await fetch(`${API}${sciezka}`, {
        headers: { Authorization: `Bearer ${uz}` },
        cache: "no-store",
      })
        .then(wynik)
        .catch((e) => ({ blad: e instanceof Error ? e.message : String(e) }));
    }
  }
  return out;
}

/** Uproszczony tytuł do porównań: bez interpunkcji, dopisków i wielkości liter. */
export function kluczTytulu(t: string): string {
  return t
    .toLowerCase()
    .replace(/\((?:deluxe|remaster(?:ed)?|reissue|edition|expanded)[^)]*\)/g, "")
    .replace(/\s*[-–—]\s*(?:deluxe|remaster(?:ed)?|reissue|.*edition).*$/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

/**
 * To, czego MusicBrainz nie ma. Porównujemy po uproszczonym tytule, bo MBID-ów
 * Spotify nie zna, a reedycje i „(Remastered)" inaczej mnożyłyby duplikaty.
 */
export function tylkoNoweTytuly(zeSpotify: SpotifyAlbum[], znane: string[]): SpotifyAlbum[] {
  const maja = new Set(znane.map(kluczTytulu));
  const widziane = new Set<string>();
  return zeSpotify.filter((a) => {
    const k = kluczTytulu(a.title);
    if (!k || maja.has(k) || widziane.has(k)) return false;
    widziane.add(k);
    return true;
  });
}
