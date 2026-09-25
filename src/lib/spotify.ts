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
/**
 * `user-read-recently-played` doszło później i świadomie: bez niego dziennik
 * odsłuchań zaczynał się w dniu, w którym ktoś pierwszy raz zostawił portal
 * otwarty — a to wygląda jak zepsuta funkcja, nie jak nowa. Spotify oddaje
 * ostatnie 50 utworów, więc historia jest od razu, a nie od jutra.
 *
 * Kto podłączył konto WCZEŚNIEJ, ma stary zakres i musi połączyć je od nowa;
 * portal go o to nie zaczepia — po prostu historii nie ciągnie.
 */
/**
 * `playlist-read-private` i `playlist-read-collaborative` doszły po to i tylko
 * po to, żeby dało się ŚCIĄGNĄĆ własne listy ze Spotify do portalu. To odczyt
 * cudzych playlist? Nie — wyłącznie swoich, i tylko wtedy, gdy ktoś sam kliknie
 * „ściągnij". Publiczne playlisty widać bez żadnego zakresu, ale człowiek
 * trzyma swoje po cichu i bez tych dwóch nie zobaczyłby nic.
 *
 * Kto podłączył konto WCZEŚNIEJ, ma stary zestaw zakresów i musi połączyć je
 * od nowa — inaczej lista playlist przyjdzie pusta.
 */
export const SPOTIFY_SCOPES = [
  "user-read-currently-playing",
  "user-read-recently-played",
  "playlist-modify-private",
  "playlist-read-private",
  "playlist-read-collaborative",
].join(" ");

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
 * KTÓRE konto Spotify jest podłączone — nazwa, a gdy się nie uda, identyfikator.
 *
 * Bez tego „Konto połączone" jest półprawdą: człowiek słucha na jednym koncie,
 * podłączył kiedyś inne i nie ma jak się o tym dowiedzieć — widzi tylko, że
 * „Słuchasz teraz" uparcie milczy. Nazwa konta rozstrzyga to w sekundę.
 */
export async function spotifyKto(userId: string): Promise<string | null> {
  const konto = await kontoSpotify(userId).catch(() => null);
  if (!konto) return null;
  const ja = await api<{ display_name?: string; id?: string }>(userId, "/me").catch(() => null);
  return ja?.display_name || ja?.id || konto.providerAccountId || null;
}

/**
 * Odłączenie konta. Kasujemy tylko powiązanie ze Spotify — konto w portalu,
 * oceny i podróże zostają nietknięte.
 */
export async function spotifyRozlacz(userId: string): Promise<void> {
  await db
    .delete(schema.accounts)
    .where(and(eq(schema.accounts.userId, userId), eq(schema.accounts.provider, "spotify")));
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

/**
 * `bezBlokady` — odmowa dotyczy TEJ funkcji, nie całego konta.
 *
 * Boleśnie ważne przy historii odsłuchań: kto podłączył Spotify przed
 * dołożeniem zakresu `user-read-recently-played`, dostaje na nią 403. Gdyby
 * liczyło się to jak odmowa dla konta, portal schowałby mu WSZYSTKO
 * spotifajowe — łącznie z „słuchasz teraz", które działa bez zarzutu — i to
 * na godzinę. Jedna nowa funkcja nie ma prawa wyłączyć działających.
 */
async function api<T>(userId: string, sciezka: string, init?: RequestInit & { bezBlokady?: boolean }): Promise<T | null> {
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
    if (!init?.bezBlokady) await cacheNote(kluczBlokady(userId), BLOKADA_TTL);
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
  /** adres PŁYTY w Spotify (nie utworu) — do nauki, patrz `zapamietajAdresPlyty` */
  albumUrl: string | null;
  cover: string | null;
  playing: boolean;
}

interface SpTrack {
  name: string;
  uri: string;
  external_urls?: { spotify?: string };
  artists?: { name: string }[];
  // `id` i `external_urls` albumu: stąd bierze się ADRES PŁYTY, którego portal
  // wcześniej nie umiał znaleźć — patrz `zapamietajAdresPlyty`.
  album?: { id?: string; name: string; images?: { url: string }[]; external_urls?: { spotify?: string } };
}

/** Adres płyty (nie utworu) z odpowiedzi Spotify. */
function adresAlbumu(t: SpTrack): string | null {
  return t.album?.external_urls?.spotify ?? (t.album?.id ? `https://open.spotify.com/album/${t.album.id}` : null);
}

/**
 * NAUKA Z ODSŁUCHÓW: zapamiętanie adresu płyty, której portal sam nie znalazł.
 *
 * Skąd pomysł i dlaczego jest dobry: przy premierze klikamy w płytę, zanim
 * jeszcze wyjdzie — Spotify jej wtedy nie ma, więc przycisk prowadzi do
 * wyszukiwarki. Kilka dni później człowiek słucha jej normalnie w Spotify,
 * a portal i tak o to pyta (kafelek „słuchasz teraz" i jednorazowa historia).
 * W tej odpowiedzi jest gotowy adres ALBUMU. Byłoby marnotrawstwem go wyrzucić
 * i dalej wysyłać ludzi do wyszukiwarki — więc wkładamy go do tego samego
 * bufora, z którego korzysta `spotifyFindAlbum`.
 *
 * Zapisujemy tylko wtedy, gdy nic tam jeszcze nie ma: wynik z wyszukiwania
 * katalogu jest równie dobry, a nadpisywanie go w kółko to zapytania do bazy
 * przy każdym mrugnięciu kafelka. Nie kosztuje to ANI JEDNEGO zapytania do
 * Spotify — dane już mamy.
 */
export async function zapamietajAdresPlyty(artist: string, album: string, url: string | null): Promise<void> {
  // Identyfikator wyciągamy z adresu, bo bufor trzyma JEDEN I TEN SAM kształt
  // dla obu dróg — tej z wyszukiwania katalogu i tej z odsłuchu. Bez `id`
  // wysyłka podróży do Spotify dostałaby pusty napis zamiast płyty.
  const id = url?.match(/album\/([A-Za-z0-9]+)/)?.[1] ?? "";
  if (!artist || !album || !url || !id) return;
  try {
    const klucz = `spotify:album:v2:${artist.toLowerCase()}|${album.toLowerCase()}`;
    const NA_ZAWSZE = 60 * 60 * 24 * 3650;
    // `cached` zapisuje tylko wtedy, gdy w buforze nic nie ma — czyli nie
    // nadpisujemy wyniku wyszukiwania i nie piszemy do bazy przy każdym
    // mrugnięciu kafelka „słuchasz teraz".
    await cached(klucz, NA_ZAWSZE, async () => ({ id, url, title: album, artists: artist }));
  } catch {
    // Nauka jest dodatkiem. Gdy się nie uda, zostaje zwykłe szukanie.
  }
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
    albumUrl: adresAlbumu(item),
    cover: item.album?.images?.[item.album.images.length - 1]?.url ?? null,
    playing: dane?.is_playing !== false,
  };
}

/**
 * Ostatnie 50 odtworzeń prosto ze Spotify — jednorazowy zastrzyk do dziennika.
 *
 * Pytamy rzadko (patrz `synchronizujHistorie`), bo to jest uzupełnianie
 * przeszłości, a nie śledzenie: przeszłość się nie zmienia.
 */
export async function recentlyPlayed(userId: string): Promise<{ artist: string; title: string; album: string; albumUrl: string | null; cover: string | null; at: Date }[]> {
  const dane = await api<{ items?: { track?: SpTrack; played_at?: string }[] }>(
    userId,
    "/me/player/recently-played?limit=50",
    // Stary zakres uprawnień to nie jest odmowa dla konta — patrz `api`.
    { bezBlokady: true },
  ).catch(() => null);
  return (dane?.items ?? [])
    .filter((i) => i.track?.name)
    .map((i) => ({
      artist: (i.track!.artists ?? []).map((a) => a.name).join(", "),
      title: i.track!.name,
      album: i.track!.album?.name ?? "",
      albumUrl: adresAlbumu(i.track!),
      cover: i.track!.album?.images?.[i.track!.album.images.length - 1]?.url ?? null,
      at: i.played_at ? new Date(i.played_at) : new Date(),
    }));
}

// ---------- playlista ze Spotify → podróż ----------

export interface SpPlaylista {
  id: string;
  nazwa: string;
  opis: string | null;
  ile: number;
  okladka: string | null;
  url: string;
  /** Czyja jest — własne pokazujemy pierwsze, cudze obserwowane niżej. */
  czyja: string | null;
  moja: boolean;
}

/**
 * Playlisty tego człowieka — jego własne i te, które obserwuje.
 *
 * Spotify oddaje po 50 na stronę; bierzemy najwyżej cztery strony (200 list),
 * bo dalej to już nie jest „moje listy", tylko archiwum, a każda strona to
 * kolejne zapytanie w kolejce.
 */
export async function spotifyPlaylisty(userId: string): Promise<SpPlaylista[]> {
  interface SpPl {
    id: string;
    name: string;
    description?: string;
    tracks?: { total?: number };
    images?: { url: string }[];
    external_urls?: { spotify?: string };
    owner?: { id?: string; display_name?: string };
  }
  const ja = await api<{ id?: string }>(userId, "/me", { bezBlokady: true }).catch(() => null);
  const out: SpPlaylista[] = [];
  for (let strona = 0; strona < 4; strona++) {
    const dane = await api<{ items?: SpPl[]; next?: string | null }>(
      userId,
      `/me/playlists?limit=50&offset=${strona * 50}`,
      // Brak zakresu to nie jest odmowa dla konta — patrz `api`.
      { bezBlokady: true },
    ).catch(() => null);
    for (const p of dane?.items ?? []) {
      if (!p?.id || !p.name) continue;
      out.push({
        id: p.id,
        nazwa: p.name,
        opis: p.description?.trim() || null,
        ile: p.tracks?.total ?? 0,
        okladka: p.images?.[0]?.url ?? null,
        url: p.external_urls?.spotify ?? `https://open.spotify.com/playlist/${p.id}`,
        czyja: p.owner?.display_name ?? p.owner?.id ?? null,
        moja: !!ja?.id && p.owner?.id === ja.id,
      });
    }
    if (!dane?.next) break;
  }
  return out;
}

export interface PlytaZPlaylisty {
  artist: string;
  album: string;
  cover: string | null;
  url: string | null;
  /** Ile utworów z tej płyty leży na playliście — po tym ją ważymy. */
  ile: number;
}

/**
 * Płyty z jednej playlisty — NIE utwory.
 *
 * Portal chodzi wokół płyt, więc playlista „50 kawałków" staje się tu listą
 * kilkunastu albumów, po jednym wpisie na album. Kolejność: najpierw te, z
 * których jest najwięcej utworów — bo to one są w tej playliście naprawdę,
 * a pojedynczy singiel bywa przypadkiem.
 */
export async function albumyZPlaylisty(userId: string, playlistId: string, maks = 400): Promise<PlytaZPlaylisty[]> {
  interface SpItem {
    track?: {
      name?: string;
      artists?: { name: string }[];
      album?: {
        name?: string;
        album_type?: string;
        images?: { url: string }[];
        external_urls?: { spotify?: string };
        artists?: { name: string }[];
      };
    };
  }
  const wg = new Map<string, PlytaZPlaylisty>();
  for (let offset = 0; offset < maks; offset += 100) {
    const dane = await api<{ items?: SpItem[]; next?: string | null }>(
      userId,
      `/playlists/${encodeURIComponent(playlistId)}/tracks?limit=100&offset=${offset}` +
        `&fields=next,items(track(name,artists(name),album(name,album_type,images,external_urls,artists(name))))`,
      { bezBlokady: true },
    ).catch(() => null);
    for (const i of dane?.items ?? []) {
      const al = i.track?.album;
      const tytul = al?.name?.trim();
      if (!al || !tytul) continue;
      const artysta = (al.artists?.length ? al.artists : i.track?.artists)?.map((a) => a.name).join(", ").trim() ?? "";
      const klucz = `${artysta.toLowerCase()}|${tytul.toLowerCase()}`;
      const juz = wg.get(klucz);
      if (juz) {
        juz.ile += 1;
        continue;
      }
      wg.set(klucz, {
        artist: artysta,
        album: tytul,
        cover: al.images?.[al.images.length - 1]?.url ?? null,
        url: al.external_urls?.spotify ?? null,
        ile: 1,
      });
    }
    if (!dane?.next) break;
  }
  return [...wg.values()].sort((a, b) => b.ile - a.ile);
}

// ---------- podróż → playlista ----------

/**
 * „Artysta – Tytuł" — mieszka teraz w `lib/names.ts`, razem z odwrotnością
 * (`zlozEtykiete`). Tu zostaje re-eksport, żeby nie przepisywać kilkunastu
 * importów; nowy kod bierze to prosto z `names`.
 */
export { rozbijEtykiete } from "./names";
import { rozbijEtykiete } from "./names";

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

/**
 * Pojedynczy utwór po nazwie. Przystanek typu RECORDING to konkretny kawałek,
 * więc do playlisty wchodzi dokładnie on — bez dosypywania reszty płyty.
 */
async function znajdzUtwor(userId: string, artist: string, title: string): Promise<string | null> {
  const szukaj = async (q: string) => {
    if (!q) return null;
    const dane = await api<{ tracks?: { items?: { uri: string }[] } }>(
      userId,
      `/search?type=track&limit=1&q=${encodeURIComponent(q)}`,
    ).catch(() => null);
    return dane?.tracks?.items?.[0]?.uri ?? null;
  };
  return (
    (await szukaj(`track:"${title}" artist:"${artist}"`)) ??
    (await szukaj([artist, title].filter(Boolean).join(" ")))
  );
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
  przystanki: { targetType: "ALBUM" | "ARTIST" | "CONCERT" | "RECORDING"; label: string }[],
): Promise<WynikWysylki | null> {
  const ja = await api<{ id: string }>(userId, "/me").catch(() => null);
  if (!ja?.id) return null;

  const uris: string[] = [];
  const pominiete: WynikWysylki["pominiete"] = [];
  for (const p of przystanki) {
    // Utwór wchodzi jeden do jednego — i to jest dokładnie ten przypadek,
    // w którym playlista wreszcie odpowiada temu, co widać na ekranie.
    if (p.targetType === "RECORDING") {
      const { artist, title } = rozbijEtykiete(p.label);
      const uri = await znajdzUtwor(userId, artist, title);
      if (uri) uris.push(uri);
      else pominiete.push({ label: p.label, powod: "nieznaleziono" });
      continue;
    }
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
  const klucz = `spotify:album:v2:${artist.toLowerCase()}|${title.toLowerCase()}`;
  // BRAKU NIE PAMIĘTAMY W OGÓLE — pamiętamy tylko trafienie.
  //
  // Premiery pokazujemy ZAPOWIEDZIAMI, więc pierwsze kliknięcie w płytę pada
  // zwykle kilka dni PRZED wydaniem: wtedy w Spotify jej jeszcze nie ma. Gdy
  // pustka lądowała w buforze, w dniu premiery odnośnik dalej prowadził do
  // wyszukiwarki, choć płyta była już na miejscu (Anthrax, „Cursum Perficio").
  // Koszt zapamiętywania jest niewspółmierny do zysku: adres ustalamy dopiero
  // przy KLIKNIĘCIU, więc jedna nieudana próba to jedno zapytanie, a nie
  // kilkadziesiąt przy rysowaniu strony.
  // Trafienie trzymamy BEZ TERMINU.
  //
  // Identyfikator płyty w Spotify jest stały: „Deadwing" ma ten sam adres od
  // lat. Kolejne terminy ważności (tydzień, potem kwartał) były liczbami
  // z sufitu — za każdym razem kupowały to samo, czyli ponowne zapytanie
  // o coś, co się nie zmieniło. Owszem, wydania czasem znikają z katalogu
  // (licencje, reedycje) — ale to rzadkie, kosztem jest jeden martwy odnośnik,
  // a nie zepsuta funkcja, i mamy na to wytrych: `/api/diag/spotify?wyczysc=1`.
  // Gdyby zaczęło się to zdarzać częściej, wtedy pomyślimy o odświeżaniu.
  const NA_ZAWSZE = 60 * 60 * 24 * 3650;
  const znalezione = await cached(klucz, NA_ZAWSZE, async () => {
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
    /**
     * TYTUŁ **I** ARTYSTA — sam tytuł to za mało.
     *
     * „Solaris" The Oceana prowadziło do singla „Solaris" niejakiego Calila:
     * tytuł zgadzał się co do litery, więc braliśmy pierwsze trafienie i guzik
     * z premier wysyłał w zupełnie obcą płytę. Przy tytułach jednowyrazowych
     * (Solaris, Eden, Mirage) to nie jest rzadki wypadek, tylko norma.
     *
     * Reguła dopasowania artysty ta sama co w Tidalu: wystarczy, że któraś ze
     * stron zawiera drugą — „Mastodon" i „Mastodon & Friends" to ten sam
     * zespół, „Sleep" i „Sleep Token" już nie.
     */
    const chce = kluczTytulu(title);
    const szukanyArtysta = kluczTytulu(artist);
    const traf =
      items.find((a) => {
        if (kluczTytulu(a.name) !== chce) return false;
        if (!szukanyArtysta) return true;
        const nazwy = (a.artists ?? []).map((x) => kluczTytulu(x.name)).filter(Boolean);
        if (!nazwy.length) return true;
        return nazwy.some((n) => n === szukanyArtysta || n.includes(szukanyArtysta) || szukanyArtysta.includes(n));
      }) ?? null;
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
  // Pustkę zapominamy TYLKO wtedy, gdy powodem była cisza po stronie Spotify
  // (pauza po 429 albo chwilowa awaria). Gdy naprawdę nie ma takiej płyty,
  // pusty wynik zostaje w buforze — inaczej każde wejście na stronę pytałoby od
  // nowa, a kwota aplikacji w trybie deweloperskim jest mała i wspólna dla
  // wszystkich odwiedzających.
  if (!znalezione) await zapomnij(klucz).catch(() => {});
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
