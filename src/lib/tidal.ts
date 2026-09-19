/**
 * Tidal od strony KONKRETNEGO użytkownika — na razie po jedno: jego listy.
 *
 * Czemu mniej niż przy Spotify: Tidal nie udostępnia niczego w rodzaju „co
 * teraz gra" ani „ostatnio odtworzone". Dziennik odsłuchów zostaje więc tam,
 * gdzie był — na kliknięciach z portalu. Tutaj chodzi o jedno: wziąć playlisty,
 * które ktoś ma u siebie, i zrobić z nich podróże. Tak samo jak ze Spotify:
 * PŁYTY, nie utwory, i tylko na kliknięcie.
 *
 * Token bierze się z tego, że człowiek sam kliknął „Połącz z Tidalem"; leży
 * w tabeli `account` obok pozostałych. Zakresy minimalne — sam odczyt.
 */
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";

const API = "https://openapi.tidal.com/v2";
const TOKEN_URL = "https://auth.tidal.com/v1/oauth2/token";

/**
 * Zakresy, o które prosimy. `user.read` jest potrzebny, żeby w ogóle wiedzieć,
 * CZYJE to konto (bez tego nie da się zapytać o jego playlisty), reszta to
 * czysty odczyt. Żadnego zapisu: portal nie zakłada nikomu playlist w Tidalu.
 */
export const TIDAL_SCOPES = ["user.read", "collection.read", "playlists.read"].join(" ");

export function tidalConfigured(): boolean {
  return !!process.env.TIDAL_CLIENT_ID && !!process.env.TIDAL_CLIENT_SECRET;
}

interface Konto {
  access_token: string | null;
  refresh_token: string | null;
  expires_at: number | null;
  providerAccountId: string;
}

async function kontoTidal(userId: string): Promise<Konto | null> {
  const row = await db.query.accounts.findFirst({
    where: and(eq(schema.accounts.userId, userId), eq(schema.accounts.provider, "tidal")),
    columns: { access_token: true, refresh_token: true, expires_at: true, providerAccountId: true },
  });
  return row ?? null;
}

/** Czy ten użytkownik podłączył Tidala (do pokazania przycisku „Połącz"). */
export async function tidalConnected(userId: string): Promise<boolean> {
  return !!(await kontoTidal(userId).catch(() => null));
}

/** Odłączenie konta — znika tylko powiązanie, portal zostaje nietknięty. */
export async function tidalRozlacz(userId: string): Promise<void> {
  await db.delete(schema.accounts).where(and(eq(schema.accounts.userId, userId), eq(schema.accounts.provider, "tidal")));
}

/**
 * Ważny token, w razie potrzeby odświeżony.
 *
 * Tidal wydaje token na dobę, a sesja w portalu trwa tygodniami — odświeżanie
 * musi być tutaj. Nowy token od razu wraca do bazy, inaczej odświeżałby się
 * przy każdym wejściu na stronę.
 *
 * UWAGA na różnicę wobec Spotify: przy odświeżaniu Tidal chce `client_id`
 * w ciele zapytania (PKCE), a nie nagłówka Basic. Sekret dokładamy tylko, gdy
 * jest — aplikacje „public" go nie mają.
 */
async function tokenDla(userId: string): Promise<string | null> {
  const konto = await kontoTidal(userId).catch(() => null);
  if (!konto) return null;
  const zapas = 60;
  const wazny = konto.expires_at && konto.expires_at - zapas > Math.floor(Date.now() / 1000);
  if (wazny && konto.access_token) return konto.access_token;
  if (!konto.refresh_token || !tidalConfigured()) return konto.access_token ?? null;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: konto.refresh_token,
    client_id: process.env.TIDAL_CLIENT_ID!,
  });
  const naglowki: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
  if (process.env.TIDAL_CLIENT_SECRET) {
    naglowki.Authorization = `Basic ${Buffer.from(`${process.env.TIDAL_CLIENT_ID}:${process.env.TIDAL_CLIENT_SECRET}`).toString("base64")}`;
  }
  const res = await fetch(TOKEN_URL, { method: "POST", headers: naglowki, body, cache: "no-store" });
  if (!res.ok) return null;
  const dane = (await res.json()) as { access_token?: string; expires_in?: number; refresh_token?: string };
  if (!dane.access_token) return null;
  await db
    .update(schema.accounts)
    .set({
      access_token: dane.access_token,
      expires_at: Math.floor(Date.now() / 1000) + (dane.expires_in ?? 86400),
      ...(dane.refresh_token ? { refresh_token: dane.refresh_token } : {}),
    })
    .where(and(eq(schema.accounts.userId, userId), eq(schema.accounts.provider, "tidal")));
  return dane.access_token;
}

/**
 * Jedno zapytanie do Tidala. `null` znaczy „nie wiemy" i jest normalnym
 * stanem — brak odpowiedzi ma chować funkcję, a nie wywalać stronę.
 *
 * Tidal mówi JSON:API (`application/vnd.api+json`), więc dane siedzą
 * w `data[]`, a rzeczy dociągnięte przez `include` — w `included[]`.
 */
async function api<T>(userId: string, sciezka: string): Promise<T | null> {
  const token = await tokenDla(userId);
  if (!token) return null;
  try {
    const res = await fetch(`${API}${sciezka}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.api+json" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const tekst = await res.text();
    return tekst ? (JSON.parse(tekst) as T) : null;
  } catch {
    return null;
  }
}

/** Kraj konta — Tidal wymaga go przy większości zapytań o katalog. */
function kraj(): string {
  return (process.env.TIDAL_COUNTRY || "PL").trim().toUpperCase();
}

interface JsonApiRes<A> {
  id: string;
  type: string;
  attributes?: A;
  relationships?: Record<string, { data?: { id: string; type: string } | { id: string; type: string }[] }>;
}
interface JsonApiDoc<A, I = unknown> {
  data?: JsonApiRes<A> | JsonApiRes<A>[];
  included?: JsonApiRes<I>[];
  links?: { next?: string };
}

/** Identyfikator zalogowanego użytkownika Tidala — od niego zaczyna się reszta. */
export async function tidalJa(userId: string): Promise<{ id: string; nazwa: string | null } | null> {
  const dane = await api<JsonApiDoc<{ username?: string; firstName?: string; email?: string }>>(userId, "/users/me");
  const d = Array.isArray(dane?.data) ? dane?.data[0] : dane?.data;
  if (!d?.id) return null;
  return { id: d.id, nazwa: d.attributes?.username ?? d.attributes?.firstName ?? null };
}

export interface TdPlaylista {
  id: string;
  nazwa: string;
  opis: string | null;
  ile: number;
  okladka: string | null;
  url: string;
}

/**
 * Playlisty tego człowieka. Bierzemy najwyżej kilka stron — dalej to już
 * archiwum, a nie „moje listy", a każda strona to kolejne zapytanie.
 */
export async function tidalPlaylisty(userId: string): Promise<TdPlaylista[]> {
  type Atr = {
    name?: string;
    description?: string;
    numberOfItems?: number;
    externalLinks?: { href?: string; meta?: { type?: string } }[];
    imageLinks?: { href?: string; meta?: { width?: number } }[];
  };
  const out: TdPlaylista[] = [];
  let sciezka: string | null = `/playlists/me?countryCode=${kraj()}`;
  for (let strona = 0; strona < 4 && sciezka; strona++) {
    const dane: JsonApiDoc<Atr> | null = await api<JsonApiDoc<Atr>>(userId, sciezka);
    const lista = Array.isArray(dane?.data) ? dane!.data : dane?.data ? [dane.data] : [];
    for (const p of lista) {
      if (!p?.id) continue;
      const a = p.attributes ?? {};
      out.push({
        id: p.id,
        nazwa: a.name?.trim() || p.id,
        opis: a.description?.trim() || null,
        ile: a.numberOfItems ?? 0,
        okladka: a.imageLinks?.[0]?.href ?? null,
        url: a.externalLinks?.find((l) => l.href)?.href ?? `https://tidal.com/playlist/${p.id}`,
      });
    }
    // `links.next` przychodzi jako gotowy kawałek adresu — idziemy nim dalej,
    // zamiast zgadywać numerację stron (Tidal stronicuje kursorem).
    const next: string | undefined = dane?.links?.next;
    sciezka = next ? (next.startsWith("/") ? next : `/playlists/me?${next.split("?")[1] ?? ""}`) : null;
  }
  return out;
}

export interface PlytaZTidala {
  artist: string;
  album: string;
  cover: string | null;
  url: string | null;
  ile: number;
}

/**
 * Płyty z jednej playlisty — NIE utwory, dokładnie jak przy Spotify.
 *
 * Portal chodzi wokół płyt, więc playlista „50 kawałków" staje się tu listą
 * kilkunastu albumów, ułożoną od tych, z których na liście jest najwięcej.
 */
export async function albumyZTidala(userId: string, playlistId: string): Promise<PlytaZTidala[]> {
  type Atr = {
    title?: string;
    imageLinks?: { href?: string }[];
    externalLinks?: { href?: string }[];
    name?: string;
  };
  const wg = new Map<string, PlytaZTidala>();
  let sciezka: string | null =
    `/playlists/${encodeURIComponent(playlistId)}/relationships/items` +
    `?countryCode=${kraj()}&include=items.albums,items.albums.artists`;
  for (let strona = 0; strona < 6 && sciezka; strona++) {
    const dane: JsonApiDoc<Atr, Atr> | null = await api<JsonApiDoc<Atr, Atr>>(userId, sciezka);
    if (!dane) break;
    const dolaczone = dane.included ?? [];
    const artysci = new Map(dolaczone.filter((x) => x.type === "artists").map((x) => [x.id, x.attributes?.name ?? ""]));
    for (const al of dolaczone.filter((x) => x.type === "albums")) {
      const tytul = al.attributes?.title?.trim();
      if (!tytul) continue;
      const rel = al.relationships?.artists?.data;
      const ids = Array.isArray(rel) ? rel.map((r) => r.id) : rel ? [rel.id] : [];
      const artysta = ids.map((i) => artysci.get(i)).filter(Boolean).join(", ");
      const klucz = `${artysta.toLowerCase()}|${tytul.toLowerCase()}`;
      const juz = wg.get(klucz);
      if (juz) {
        juz.ile += 1;
        continue;
      }
      wg.set(klucz, {
        artist: artysta,
        album: tytul,
        cover: al.attributes?.imageLinks?.[0]?.href ?? null,
        url: al.attributes?.externalLinks?.find((l) => l.href)?.href ?? null,
        ile: 1,
      });
    }
    const next: string | undefined = dane.links?.next;
    sciezka = next && next.startsWith("/") ? next : null;
  }
  return [...wg.values()].sort((a, b) => b.ile - a.ile);
}

// ---------- katalog: adres KONKRETNEJ płyty w Tidalu ----------

/**
 * Token aplikacji (client credentials) — do katalogu, bez niczyjego konta.
 *
 * Po co osobno od tokenu użytkownika: adres płyty ustalamy przy KLIKNIĘCIU,
 * także dla gościa, który nie ma i nie będzie miał konta Tidala. Katalog jest
 * wspólny, więc wystarczy, że portal przedstawi się jako on sam.
 */
async function tokenAplikacji(): Promise<string | null> {
  if (!tidalConfigured()) return null;
  const { cached } = await import("./cache");
  // Token żyje dobę; trzymamy go krócej, żeby nie trafić w moment wygaśnięcia.
  const dane = await cached<{ t: string } | null>("tidal:app-token:v1", 60 * 60 * 20, async () => {
    const basic = Buffer.from(`${process.env.TIDAL_CLIENT_ID}:${process.env.TIDAL_CLIENT_SECRET}`).toString("base64");
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "client_credentials" }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`tidal token ${res.status}`);
    const j = (await res.json()) as { access_token?: string };
    if (!j.access_token) throw new Error("tidal token bez access_token");
    return { t: j.access_token };
  }).catch(() => null);
  return dane?.t ?? null;
}

/** Uproszczony tytuł do porównań — reedycje i „(Remastered)" nie mogą mylić. */
function uproszcz(t: string): string {
  return t
    .toLowerCase()
    .replace(/\((?:deluxe|remaster(?:ed)?|reissue|edition|expanded)[^)]*\)/g, "")
    .replace(/\s*[-–—]\s*(?:deluxe|remaster(?:ed)?|reissue|.*edition).*$/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

/**
 * Adres KONKRETNEJ płyty w Tidalu — albo nic.
 *
 * Dotąd każdy odnośnik do Tidala prowadził do wyszukiwarki, bo portal nie miał
 * jak zapytać ich katalogu. Teraz ma. Zasady te same co przy Spotify, wyuczone
 * na własnych błędach:
 * - TRAFIENIE pamiętamy bez terminu (płyta nie zmieni adresu),
 * - BRAKU nie pamiętamy w ogóle (premiery klikamy przed wydaniem, gdy płyty
 *   jeszcze tam nie ma — zapamiętana pustka zostawałaby na zawsze),
 * - nie zgadujemy: gdy tytuł się nie zgadza, wolimy wyszukiwarkę niż wysłanie
 *   człowieka pod cudzą płytę.
 */
export async function tidalAlbumUrl(artist: string, title: string): Promise<string | null> {
  if (!tidalConfigured() || !title) return null;
  const { cached, cacheForget } = await import("./cache");
  const klucz = `tidal:album:v1:${artist.toLowerCase()}|${title.toLowerCase()}`;
  const NA_ZAWSZE = 60 * 60 * 24 * 3650;

  const znalezione = await cached<string | null>(klucz, NA_ZAWSZE, async () => {
    const token = await tokenAplikacji();
    if (!token) return null;
    const fraza = [artist, title].filter(Boolean).join(" ");
    const url =
      `${API}/searchResults/${encodeURIComponent(fraza)}` +
      `?countryCode=${kraj()}&include=albums,albums.artists`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.api+json" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    type Atr = { title?: string; name?: string; externalLinks?: { href?: string }[] };
    const dane = (await res.json()) as JsonApiDoc<Atr, Atr>;
    const dolaczone = dane.included ?? [];
    const artysci = new Map(dolaczone.filter((x) => x.type === "artists").map((x) => [x.id, x.attributes?.name ?? ""]));
    const szukanyTytul = uproszcz(title);
    const szukanyArtysta = uproszcz(artist);
    for (const al of dolaczone.filter((x) => x.type === "albums")) {
      const tytul = al.attributes?.title ?? "";
      if (uproszcz(tytul) !== szukanyTytul) continue;
      if (szukanyArtysta) {
        const rel = al.relationships?.artists?.data;
        const ids = Array.isArray(rel) ? rel.map((r) => r.id) : rel ? [rel.id] : [];
        const nazwy = ids.map((i) => uproszcz(artysci.get(i) ?? "")).filter(Boolean);
        // Wystarczy, że któraś ze stron zawiera drugą: „Mastodon" vs
        // „Mastodon & Friends" to ta sama płyta, „Sleep" vs „Sleep Token" nie.
        const pasuje = nazwy.some((n) => n === szukanyArtysta || n.includes(szukanyArtysta) || szukanyArtysta.includes(n));
        if (nazwy.length && !pasuje) continue;
      }
      return al.attributes?.externalLinks?.find((l) => l.href)?.href ?? `https://tidal.com/album/${al.id}`;
    }
    return null;
  }).catch(() => null);

  if (!znalezione) await cacheForget(klucz).catch(() => {});
  return znalezione;
}
