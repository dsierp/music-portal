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

const API = "https://api.spotify.com/v1";
const TOKEN_URL = "https://accounts.spotify.com/api/token";

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

async function api<T>(userId: string, sciezka: string, init?: RequestInit): Promise<T | null> {
  const token = await tokenDla(userId);
  if (!token) return null;
  const res = await fetch(`${API}${sciezka}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
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

async function znajdzAlbum(userId: string, artist: string, title: string): Promise<string | null> {
  const q = artist ? `album:${title} artist:${artist}` : title;
  const dane = await api<{ albums?: { items?: { id: string }[] } }>(
    userId,
    `/search?type=album&limit=1&q=${encodeURIComponent(q)}`,
  ).catch(() => null);
  return dane?.albums?.items?.[0]?.id ?? null;
}

async function utworyAlbumu(userId: string, albumId: string): Promise<string[]> {
  const dane = await api<{ items?: { uri: string }[] }>(userId, `/albums/${albumId}/tracks?limit=50`).catch(() => null);
  return (dane?.items ?? []).map((t) => t.uri).filter(Boolean);
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
    const albumId = await znajdzAlbum(userId, artist, title);
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
