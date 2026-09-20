/**
 * TEMPO (BPM) — skąd je bierzemy i czemu akurat stamtąd.
 *
 * Spotify miało kiedyś końcówkę z cechami utworu (`audio-features`, a w niej
 * tempo) i byłoby to najwygodniejsze źródło. Zamknęli ją dla nowych aplikacji
 * pod koniec 2024 — nasza jest nowa, więc tej drogi nie ma i nie będzie.
 *
 * Zostaje DEEZER: jego obiekt utworu niesie `bpm`, bez klucza i bez kolejki,
 * a portal i tak już z niego korzysta przy szukaniu. Dane są algorytmiczne,
 * nie ręczne — i trzeba o tym pamiętać przy metalu, gdzie automat regularnie
 * liczy blast na pół tempa albo podwójnie (90 zamiast 180 i odwrotnie).
 * Dlatego pokazujemy „ok. 180", a nie „180,00", i nigdy nie budujemy na tej
 * liczbie niczego, czego nie da się cofnąć.
 *
 * ZASADY BUFORA — te same co przy adresach płyt:
 * — trafienie pamiętamy BEZ TERMINU (tempo nagrania się nie zmienia),
 * — pudła nie pamiętamy wcale (dziś Deezer nie zna płyty, za tydzień zna),
 * — `bpm: 0` od Deezera znaczy „nie policzyli", a nie „cisza" — traktujemy je
 *   jak brak danych i mówimy „nie wiem".
 */
import { cached, cacheForget } from "./cache";

const API = "https://api.deezer.com";
const TIMEOUT_MS = 4000;
/** Tempo się nie zmienia — trzymamy trafienia praktycznie na zawsze. */
const NA_ZAWSZE = 60 * 60 * 24 * 3650;
/** Ile utworów dopytujemy pojedynczo, gdy lista albumu nie niesie tempa. */
const MAKS_DOPYTAN = 14;

export interface UtworBpm {
  tytul: string;
  /** null = Deezer nie policzył (albo nie zna) — mówimy „nie wiem" */
  bpm: number | null;
}

export interface BpmPlyty {
  /** mediana z policzonych utworów; null, gdy nie znamy ani jednego */
  mediana: number | null;
  utwory: UtworBpm[];
  /** ile utworów udało się zmierzyć — do uczciwego podpisu pod liczbą */
  znane: number;
}

async function pobierz<T>(sciezka: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${sciezka}`, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Mediana, nie średnia: jedno intro na 60 BPM nie ma zaniżać całej płyty. */
export function mediana(liczby: number[]): number | null {
  const s = liczby.filter((n) => n > 0).sort((a, b) => a - b);
  if (!s.length) return null;
  const p = Math.floor(s.length / 2);
  return s.length % 2 ? s[p] : Math.round((s[p - 1] + s[p]) / 2);
}

interface DzTrack {
  id: number;
  title: string;
  bpm?: number;
}

/**
 * Tempo utworów z płyty. Pusta lista znaczy „nie wiemy" i jest normalnym
 * stanem — ekran ma wtedy nie pokazywać kolumny, a nie kłamać zerami.
 */
export async function bpmPlyty(artist: string, album: string): Promise<BpmPlyty> {
  const pusto: BpmPlyty = { mediana: null, utwory: [], znane: 0 };
  if (!artist?.trim() || !album?.trim()) return pusto;
  const klucz = `bpm:album:v1:${artist.toLowerCase()}|${album.toLowerCase()}`;

  const wynik = await cached<BpmPlyty | null>(klucz, NA_ZAWSZE, async () => {
    // Szukamy płyty po zespole i tytule — składnia pól Deezera trafia celniej
    // niż zlepiony tekst, bo inaczej „III" znajduje pół katalogu.
    const szukaj = await pobierz<{ data?: { id: number; title: string; artist?: { name?: string } }[] }>(
      `/search/album?q=${encodeURIComponent(`artist:"${artist}" album:"${album}"`)}&limit=5`,
    );
    const kandydat = (szukaj?.data ?? [])[0];
    if (!kandydat?.id) return null;

    const lista = await pobierz<{ data?: DzTrack[] }>(`/album/${kandydat.id}/tracks?limit=60`);
    const utwory = lista?.data ?? [];
    if (!utwory.length) return null;

    /**
     * Lista utworów albumu bywa skrócona i wtedy nie ma w niej `bpm` — pełne
     * tempo siedzi dopiero w obiekcie pojedynczego utworu. Dopytujemy więc
     * tylko o te, których brakuje, i tylko kilkanaście: to ma być dodatek do
     * strony, a nie jej najdroższa część.
     */
    const out: UtworBpm[] = [];
    let dopytania = 0;
    for (const tr of utwory) {
      let bpm = Number(tr.bpm ?? 0);
      if (!bpm && dopytania < MAKS_DOPYTAN) {
        dopytania += 1;
        const pelny = await pobierz<DzTrack>(`/track/${tr.id}`);
        bpm = Number(pelny?.bpm ?? 0);
      }
      out.push({ tytul: tr.title, bpm: bpm > 0 ? Math.round(bpm) : null });
    }
    const znane = out.filter((u) => u.bpm).length;
    if (!znane) return null; // sama lista tytułów bez tempa jest tu bez wartości
    return { mediana: mediana(out.map((u) => u.bpm ?? 0)), utwory: out, znane };
  }).catch(() => null);

  // Pudła nie zapamiętujemy — jutro Deezer może tę płytę mieć.
  if (!wynik) {
    await cacheForget(klucz).catch(() => {});
    return pusto;
  }
  return wynik;
}

/**
 * Jedna liczba dla płyty — do sprawdzania, czy mieści się w zakresie.
 * `null` znaczy „nie wiem"; wołający MUSI to odróżnić od „nie mieści się".
 */
export async function bpmMediana(artist: string, album: string): Promise<number | null> {
  return (await bpmPlyty(artist, album)).mediana;
}

/**
 * Zakres tempa wyłuskany z tego, co człowiek napisał.
 *
 * Rozumie „bpm 220-230", „220–230 bpm", „około 180 bpm", „szybsze niż 200",
 * „wolniej niż 90". Zwraca `null`, gdy o tempie nie ma mowy — wtedy nic nie
 * filtrujemy, bo cicha zmiana wyników na podstawie zgadywania byłaby gorsza
 * niż brak funkcji.
 */
export function zakresBpm(tekst: string): { min: number; max: number } | null {
  const t = tekst.toLowerCase();
  if (!/\bbpm\b|tempo|uderze/.test(t)) return null;

  const przedzial = t.match(/(\d{2,3})\s*[-–—do]{1,2}\s*(\d{2,3})/);
  if (przedzial) {
    const a = Number(przedzial[1]);
    const b = Number(przedzial[2]);
    if (a > 0 && b > 0) return { min: Math.min(a, b), max: Math.max(a, b) };
  }
  const szybciej = t.match(/(?:szybsz\w*|powy[żz]ej|wi[ęe]cej ni[żz]|od)\s*(\d{2,3})/);
  if (szybciej) return { min: Number(szybciej[1]), max: 400 };
  const wolniej = t.match(/(?:wolniej\w*|poni[żz]ej|mniej ni[żz]|do)\s*(\d{2,3})/);
  if (wolniej) return { min: 20, max: Number(wolniej[1]) };
  // „około 180 bpm" — bierzemy ±10%, bo nikt nie ma na myśli dokładnie 180.
  const okolo = t.match(/(\d{2,3})\s*bpm/);
  if (okolo) {
    const n = Number(okolo[1]);
    if (n >= 20 && n <= 400) return { min: Math.round(n * 0.9), max: Math.round(n * 1.1) };
  }
  return null;
}

/**
 * Czy tempo płyty mieści się w zakresie — z przymrużeniem oka na pół i podwójne.
 *
 * Automat liczący tempo regularnie myli blast (200) z half-timem (100). Gdyby
 * filtr brał liczbę dosłownie, wyrzucałby właśnie te płyty, o które chodzi.
 * Dlatego sprawdzamy też podwojoną i połówkową wartość — i mówimy o tym
 * wprost w opisie wyniku, zamiast udawać precyzję, której tu nie ma.
 */
export function wZakresie(bpm: number, zakres: { min: number; max: number }): boolean {
  const pasuje = (n: number) => n >= zakres.min && n <= zakres.max;
  return pasuje(bpm) || pasuje(bpm * 2) || pasuje(bpm / 2);
}
