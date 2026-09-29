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
import type { MbArtist, MbRelease, MbReleaseGroup } from "./musicbrainz";

/**
 * Pamięć „schematu nie ma" — żeby przed pierwszym importem nie pukać do bazy
 * z pytaniem skazanym na błąd przy każdym artyście. Po kwadransie sprawdzamy
 * znowu: import mógł właśnie się zakończyć.
 */
/**
 * Osobno dla każdej tabeli: po dołożeniu nowej (np. `plyta`) stary import jej
 * jeszcze nie ma — i to nie może wyłączać odczytu artystów, które są.
 */
const brakDo = new Map<string, number>();
const PRZERWA_MS = 15 * 60 * 1000;

function wlaczone(tabela: string): boolean {
  if ((process.env.MB_LOKALNIE ?? "").trim() === "0") return false;
  if (process.env.MB_FIXTURES) return false; // testy mają czytać swoje pliki
  return Date.now() >= (brakDo.get(tabela) ?? 0);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function wiersz<T>(tabela: string, zapytanie: ReturnType<typeof sql>): Promise<T | null> {
  try {
    const wynik = (await db.execute(zapytanie)) as unknown as { rows: T[] };
    return wynik.rows?.[0] ?? null;
  } catch (e) {
    // 42P01 = nie ma takiej tabeli, 3F000 = nie ma takiego schematu.
    const kod = (e as { code?: string; cause?: { code?: string } })?.code ?? (e as { cause?: { code?: string } })?.cause?.code;
    if (kod === "42P01" || kod === "3F000") brakDo.set(tabela, Date.now() + PRZERWA_MS);
    return null;
  }
}

/** Artysta z relacjami, gatunkami, aliasami — jak /ws/2/artist/{id}?inc=… */
export async function mbLokalnieArtysta(mbid: string): Promise<MbArtist | null> {
  if (!wlaczone("artysta") || !UUID.test(mbid)) return null;
  const r = await wiersz<{ doc: MbArtist }>("artysta", sql`select doc from mb.artysta where gid = ${mbid}::uuid`);
  return r?.doc ?? null;
}

/**
 * Płyty artysty — jak przeglądanie /ws/2/release-group?artist={id}.
 *
 * Artysta znany, a płyt brak (muzyk sesyjny, producent) to pusta lista, NIE
 * `null` — inaczej każdy taki człowiek wracałby do sieci po nic.
 */
export async function mbLokalnieDyskografia(mbid: string): Promise<MbReleaseGroup[] | null> {
  if (!wlaczone("dyskografia") || !UUID.test(mbid)) return null;
  const r = await wiersz<{ doc: MbReleaseGroup[] | null }>(
    "dyskografia",
    sql`select d.doc from mb.artysta a left join mb.dyskografia d on d.gid = a.gid where a.gid = ${mbid}::uuid`,
  );
  if (!r) return null;
  return r.doc ?? [];
}

/**
 * Płyta (grupa wydawnicza) i jej wybrane wydanie — jak /ws/2/release-group/{id}
 * plus /ws/2/release/{id} dla wydania, które wybrałby `pickRelease`.
 * Import wybiera to wydanie tą samą regułą, więc strona płyty dostaje oba
 * dokumenty jednym odczytem. `wydanie` bywa puste (płyta bez żadnego wydania).
 */
export async function mbLokalniePlyta(mbid: string): Promise<{ plyta: MbReleaseGroup; wydanie: MbRelease | null } | null> {
  if (!wlaczone("plyta") || !UUID.test(mbid)) return null;
  const r = await wiersz<{ plyta: MbReleaseGroup; wydanie: MbRelease | null }>(
    "plyta",
    sql`select p.doc as plyta, w.doc as wydanie from mb.plyta p left join mb.wydanie w on w.rg_gid = p.gid where p.gid = ${mbid}::uuid`,
  );
  return r ? { plyta: r.plyta, wydanie: r.wydanie ?? null } : null;
}

/**
 * Czy jest indeks po nazwie artysty. Bez niego szukanie po nazwie przechodzi
 * przez całą tabelę (sekundy na pytanie) — wtedy lepiej zapytać sieć.
 * Sprawdzamy raz na kwadrans, bo indeks dochodzi z kolejnym importem.
 */
let indeksNazwy: { jest: boolean; do: number } | null = null;
async function jestIndeksNazwy(): Promise<boolean> {
  if (indeksNazwy && indeksNazwy.do > Date.now()) return indeksNazwy.jest;
  let jest = false;
  try {
    const w = (await db.execute(
      sql`select 1 from pg_indexes where schemaname = 'mb' and tablename = 'artysta' and indexname = 'artysta_nazwa'`,
    )) as unknown as { rows: unknown[] };
    jest = (w.rows?.length ?? 0) > 0;
  } catch {
    jest = false;
  }
  indeksNazwy = { jest, do: Date.now() + PRZERWA_MS };
  return jest;
}

/**
 * Płyty wykonawcy o tej NAZWIE — do sprawdzania płyt podanych słownie
 * („Clipse – Let God Sort Em Out") bez pytania wyszukiwarki MusicBrainz.
 *
 * Dopasowanie tytułu robi wołający (`findAlbumMbid`) tą samą regułą co dla
 * wyników z sieci. Przy podpisach zbiorowych („Yusef Lateef & Adam Rudolph")
 * próbujemy też pierwszej osoby — wspólna płyta i tak leży w jej dyskografii.
 * `null` = nie wiemy (brak kopii albo indeksu) → pytaj sieć; `[]` = wiemy, że nic.
 */
export async function mbLokalniePlytyWykonawcy(artysta: string): Promise<MbReleaseGroup[] | null> {
  if (!wlaczone("dyskografia") || !artysta.trim()) return null;
  if (!(await jestIndeksNazwy())) return null;
  const nazwy = [artysta.trim()];
  const pierwszy = artysta.split(/\s*(?:&|,|\bfeat\.?|\bft\.?|\band\b|\bi\b|\bwith\b)\s*/i)[0]?.trim();
  if (pierwszy && pierwszy.toLowerCase() !== nazwy[0].toLowerCase()) nazwy.push(pierwszy);
  const wynik: MbReleaseGroup[] = [];
  for (const n of nazwy) {
    try {
      const w = (await db.execute(
        sql`select d.doc from mb.artysta a join mb.dyskografia d on d.gid = a.gid where lower(a.doc->>'name') = lower(${n}) limit 5`,
      )) as unknown as { rows: { doc: MbReleaseGroup[] }[] };
      for (const r of w.rows ?? []) wynik.push(...(r.doc ?? []));
    } catch {
      return null;
    }
    if (wynik.length) break;
  }
  return wynik;
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
