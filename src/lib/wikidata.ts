/**
 * Daty członkostwa z Wikidanych — łatka na dziury w MusicBrainz.
 *
 * MusicBrainz nagminnie ma relację „member of band" bez dat: Inferno siedzi
 * w Behemocie od 1997 i każdy to wie, a w bazie jest goła relacja. Wikidane
 * trzymają to samo w polach P463 („członek zespołu", od strony człowieka)
 * i P527 („składa się z", od strony zespołu), a przy każdym z nich kwalifikatory
 * P580 (początek) i P582 (koniec). To dane strukturalne, nie zdanie w artykule,
 * więc da się je czytać maszynowo bez zgadywania.
 *
 * Sklejamy je z MusicBrainz po P434 — identyfikatorze artysty w MB, który
 * Wikidane trzymają przy encji. Bez tego zostałoby dopasowywanie po nazwie,
 * a nazwy zespołów się powtarzają.
 *
 * Zasada: Wikidane tylko UZUPEŁNIAJĄ. Jeśli MusicBrainz ma datę, zostaje jego.
 */
import { cached, TTL } from "./cache";
import type { Links } from "./musicbrainz";
import { normalizeUserAgent } from "./musicbrainz";

const UA = normalizeUserAgent(process.env.MUSICBRAINZ_USER_AGENT);

/** Ile encji dociągamy za jednym zamachem — API Wikidanych przyjmuje 50. */
const BATCH = 50;

interface WdTimeValue {
  time?: string;
  precision?: number;
}
interface WdSnak {
  datavalue?: { value?: WdTimeValue | { id?: string } | string };
}
interface WdClaim {
  mainsnak?: WdSnak;
  qualifiers?: Record<string, WdSnak[]>;
}
interface WdEntity {
  labels?: Record<string, { value: string }>;
  claims?: Record<string, WdClaim[]>;
}

export interface WdSpan {
  /** MBID encji po drugiej stronie relacji (z P434) — null, gdy Wikidane go nie mają. */
  mbid: string | null;
  qid: string;
  label: string;
  begin: string | null;
  end: string | null;
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * „+1997-01-01T00:00:00Z" → „1997-01-01"; przy precyzji rocznej → „1997".
 * Daty przed naszą erą i inne dziwactwa odrzucamy — w muzyce ich nie ma.
 */
export function wdTime(v: WdTimeValue | undefined): string | null {
  const raw = v?.time;
  if (!raw || !raw.startsWith("+")) return null;
  const iso = raw.slice(1, 11); // RRRR-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const precision = v?.precision ?? 11;
  if (precision <= 9) return iso.slice(0, 4);
  if (precision === 10) return iso.slice(0, 7);
  return iso;
}

function qidOf(snak: WdSnak | undefined): string | null {
  const val = snak?.datavalue?.value;
  if (val && typeof val === "object" && "id" in val && typeof val.id === "string") return val.id;
  return null;
}

function timeQualifier(claim: WdClaim, prop: string): string | null {
  const snak = claim.qualifiers?.[prop]?.[0];
  const val = snak?.datavalue?.value;
  if (val && typeof val === "object" && "time" in val) return wdTime(val as WdTimeValue);
  return null;
}

async function entities(qids: string[]): Promise<Record<string, WdEntity>> {
  const out: Record<string, WdEntity> = {};
  for (let i = 0; i < qids.length; i += BATCH) {
    const chunk = qids.slice(i, i + BATCH);
    const data = await cached(`wd:batch:${chunk.join(",")}`, TTL.wiki, () =>
      getJson<{ entities?: Record<string, WdEntity> }>(
        `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${chunk.join("|")}` +
          `&props=labels|claims&languages=en|pl|es|de&format=json&origin=*`,
      ),
    );
    Object.assign(out, data?.entities ?? {});
  }
  return out;
}

function labelOf(e: WdEntity | undefined, fallback: string): string {
  return e?.labels?.en?.value ?? e?.labels?.pl?.value ?? Object.values(e?.labels ?? {})[0]?.value ?? fallback;
}

/** Wyciąga Q-id z linku do Wikidanych, który MusicBrainz podaje przy artyście. */
export function qidFromLinks(links: Links): string | null {
  return links.wikidata?.match(/(Q\d+)/)?.[1] ?? null;
}

/**
 * Okresy z Wikidanych dla jednego artysty.
 *
 * `prop` decyduje o kierunku: P463 to „w jakich zespołach grał", P527 to „kto
 * grał u niego". Zwracamy też encje bez MBID-u — nazwa czasem wystarczy, żeby
 * dopasować wiersz, a bez tego traciliśmy informację zupełnie.
 */
async function spansFor(qid: string, prop: "P463" | "P527"): Promise<WdSpan[]> {
  return cached(`wd:spans:v1:${prop}:${qid}`, TTL.wiki, async () => {
    const data = await getJson<{ entities?: Record<string, WdEntity> }>(
      `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`,
    );
    const claims = data?.entities?.[qid]?.claims?.[prop] ?? [];
    const rows = claims
      .map((c) => ({ qid: qidOf(c.mainsnak), begin: timeQualifier(c, "P580"), end: timeQualifier(c, "P582") }))
      .filter((r): r is { qid: string; begin: string | null; end: string | null } => !!r.qid);
    if (!rows.length) return [];
    const info = await entities([...new Set(rows.map((r) => r.qid))]);
    return rows.map((r) => {
      const e = info[r.qid];
      const mbClaim = e?.claims?.P434?.[0]?.mainsnak?.datavalue?.value;
      return {
        qid: r.qid,
        mbid: typeof mbClaim === "string" ? mbClaim : null,
        label: labelOf(e, r.qid),
        begin: r.begin,
        end: r.end,
      };
    });
  });
}

/** Zespoły, w których grał — od strony człowieka (P463). */
export async function wdMemberships(links: Links): Promise<WdSpan[]> {
  const qid = qidFromLinks(links);
  if (!qid) return [];
  return spansFor(qid, "P463").catch(() => []);
}

/** Ludzie, którzy grali w zespole (albo u solisty) — od strony zespołu (P527). */
export async function wdMembers(links: Links): Promise<WdSpan[]> {
  const qid = qidFromLinks(links);
  if (!qid) return [];
  return spansFor(qid, "P527").catch(() => []);
}

interface Datable {
  mbid: string;
  name: string;
  begin: string | null;
  end: string | null;
  current?: boolean;
  /** skąd są daty — do podpisu na osi; „mb" nie oznaczamy, bo to domyślne źródło */
  datesFrom?: "wikidata";
}

/**
 * Dokleja brakujące daty do relacji z MusicBrainz.
 *
 * Uzupełniamy WYŁĄCZNIE puste pola: gdy MusicBrainz ma początek, a Wikidane
 * mają inny, zostaje MusicBrainz — jedna baza jako źródło prawdy jest mniej
 * myląca niż mieszanka, a rozbieżności dat i tak nie rozstrzygniemy.
 * Dopasowanie po MBID, a gdy Wikidane go nie mają — po nazwie bez wielkości
 * liter, bo to lepsze niż wyrzucenie informacji.
 */
export function mergeDates<T extends Datable>(items: T[], spans: WdSpan[]): T[] {
  if (!spans.length) return items;
  const byMbid = new Map(spans.filter((s) => s.mbid).map((s) => [s.mbid as string, s]));
  const byName = new Map(spans.map((s) => [s.label.toLowerCase(), s]));
  return items.map((it) => {
    if (it.begin && it.end) return it;
    const hit = byMbid.get(it.mbid) ?? byName.get(it.name.toLowerCase());
    if (!hit || (!hit.begin && !hit.end)) return it;
    const begin = it.begin ?? hit.begin;
    const end = it.end ?? hit.end;
    if (begin === it.begin && end === it.end) return it;
    // Skoro Wikidane znają datę odejścia, to nie jest już „obecnie".
    return { ...it, begin, end, current: end ? false : it.current, datesFrom: "wikidata" as const };
  });
}
