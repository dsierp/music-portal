/**
 * MusicBrainz z własnej bazy — schemat `mb` w Neonie.
 *
 * Co tu jest: gotowe odpowiedzi w kształcie API MusicBrainz (/ws/2), złożone
 * raz w tygodniu z pełnego zrzutu przez scripts/mb/import.sh. Portal czyta je
 * dokładnie tak, jak czytał odpowiedzi z sieci — ta sama logika składów,
 * dyskografii, linków — tylko zamiast kolejki po sekundzie na zapytanie jest
 * jeden odczyt po kluczu.
 *
 * Zasada: własna baza jest PIERWSZA, publiczny MusicBrainz jest ASEKURACJĄ.
 * Każda funkcja zwraca `null`, gdy nie ma czego dać — schemat jeszcze nie
 * istnieje (przed pierwszym importem), artysta dopisany do MusicBrainz po
 * ostatnim zrzucie, chwilowa awaria bazy — i wtedy portal idzie do sieci
 * jak dotąd. Nic nie może się zepsuć przez to, że tej warstwy nie ma.
 *
 * Wyłącznik awaryjny: MB_LOKALNIE=0 w Vercelu — portal wraca do samej sieci.
 */
import { sql } from "drizzle-orm";
import { db } from "@/db";
import type { MbArtist, MbReleaseGroup } from "./musicbrainz";

/**
 * Pamięć „schematu nie ma" — żeby przed pierwszym importem nie pukać do bazy
 * z pytaniem skazanym na błąd przy każdym artyście. Po kwadransie sprawdzamy
 * znowu: import mógł właśnie się zakończyć.
 */
let brakDo = 0;
const PRZERWA_MS = 15 * 60 * 1000;

function wlaczone(): boolean {
  if ((process.env.MB_LOKALNIE ?? "").trim() === "0") return false;
  if (process.env.MB_FIXTURES) return false; // testy mają czytać swoje pliki
  return Date.now() >= brakDo;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function wiersz<T>(zapytanie: ReturnType<typeof sql>): Promise<T | null> {
  try {
    const wynik = (await db.execute(zapytanie)) as unknown as { rows: T[] };
    return wynik.rows?.[0] ?? null;
  } catch (e) {
    // 42P01 = nie ma takiej tabeli, 3F000 = nie ma takiego schematu.
    const kod = (e as { code?: string; cause?: { code?: string } })?.code ?? (e as { cause?: { code?: string } })?.cause?.code;
    if (kod === "42P01" || kod === "3F000") brakDo = Date.now() + PRZERWA_MS;
    return null;
  }
}

/** Artysta z relacjami, gatunkami, aliasami — jak /ws/2/artist/{id}?inc=… */
export async function mbLokalnieArtysta(mbid: string): Promise<MbArtist | null> {
  if (!wlaczone() || !UUID.test(mbid)) return null;
  const r = await wiersz<{ doc: MbArtist }>(sql`select doc from mb.artysta where gid = ${mbid}::uuid`);
  return r?.doc ?? null;
}

/**
 * Płyty artysty — jak przeglądanie /ws/2/release-group?artist={id}.
 *
 * Artysta znany, a płyt brak (muzyk sesyjny, producent) to pusta lista, NIE
 * `null` — inaczej każdy taki człowiek wracałby do sieci po nic.
 */
export async function mbLokalnieDyskografia(mbid: string): Promise<MbReleaseGroup[] | null> {
  if (!wlaczone() || !UUID.test(mbid)) return null;
  const r = await wiersz<{ doc: MbReleaseGroup[] | null }>(
    sql`select d.doc from mb.artysta a left join mb.dyskografia d on d.gid = a.gid where a.gid = ${mbid}::uuid`,
  );
  if (!r) return null;
  return r.doc ?? [];
}

/** Stan kopii: z którego zrzutu, ilu artystów — dla /api/diag/mb. */
export async function mbLokalnieStan(): Promise<Record<string, string> | null> {
  try {
    const wynik = (await db.execute(sql`select klucz, wartosc from mb.stan`)) as unknown as { rows: { klucz: string; wartosc: string }[] };
    return Object.fromEntries((wynik.rows ?? []).map((w) => [w.klucz, w.wartosc]));
  } catch {
    return null;
  }
}
