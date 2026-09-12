/**
 * Model językowy — jedyne miejsce w portalu, które go woła.
 *
 * ZASADA, KTÓREJ NIE WOLNO ZŁAMAĆ: model PROPONUJE, MusicBrainz POTWIERDZA.
 * Model potrafi podać płytę, której nie ma — z przekonującym opisem, rokiem
 * wydania i nazwą wytwórni. Dlatego nic, co stąd wyjdzie, nie trafia na ekran
 * bez przejścia przez `findAlbumMbid`. Portal z założenia nie buduje własnej
 * bazy wiedzy; tu też nie zaczynamy.
 *
 * DWAJ DOSTAWCY, JEDEN INTERFEJS. Portal umie gadać albo wprost z Anthropic,
 * albo przez OpenRouter — ten drugi daje jeden klucz do wielu modeli, więc da
 * się przełączać model samą zmienną środowiskową, bez ruszania kodu. Wybiera
 * ten, na który jest klucz; gdy są oba, wygrywa OpenRouter (ustawiono go
 * świadomie, a ANTHROPIC_API_KEY bywa w środowisku z innych powodów).
 *
 * Klucze: OPENROUTER_API_KEY albo ANTHROPIC_API_KEY (Vercel → Settings →
 * Environment Variables, albo .env.local na maszynie). Bez żadnego portal
 * działa normalnie — ekran „w nieznane" mówi, że jest nieskonfigurowany,
 * zamiast się wywalać.
 */

/** Model do zmiany bez ruszania kodu — inny dla każdego dostawcy. */
const MODEL_ANTHROPIC = process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest";
const MODEL_OPENROUTER = process.env.OPENROUTER_MODEL || "anthropic/claude-3.5-haiku";

/**
 * Modele awaryjne u OpenRoutera — próbowane po kolei, gdy ten właściwy odmówi
 * z powodu PIENIĘDZY albo NIEISTNIENIA (402 / 404).
 *
 * Po co: konto bez doładowania dostaje 402 na każdym płatnym modelu i ekran
 * jest martwy, choć klucz jest dobry. Modele z końcówką `:free` nic nie
 * kosztują (mają za to dzienny limit), więc portal ma czym oddychać, zanim
 * ktokolwiek cokolwiek doładuje. Lista jest kilkuelementowa świadomie —
 * identyfikatory u OpenRoutera bywają wycofywane i wtedy 404 zdejmuje jeden,
 * a nie całą funkcję.
 *
 * Do niszowej muzyki te modele są słabsze niż Haiku. To jest rozruch, nie cel.
 */
const MODELE_ZAPASOWE = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemini-2.0-flash-exp:free",
  "qwen/qwen-2.5-72b-instruct:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
];
const API_ANTHROPIC = "https://api.anthropic.com/v1/messages";
const API_OPENROUTER = "https://openrouter.ai/api/v1/chat/completions";

/** Adres portalu — OpenRouter prosi o niego w nagłówkach, do statystyk. */
const SKAD = process.env.NEXT_PUBLIC_SITE_URL || "https://music-travel.app";

export function aiSkonfigurowane(): boolean {
  return !!(process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY);
}

/** Który dostawca obsłuży zapytanie — do pokazania w logach i diagnostyce. */
export function ktoryModel(): string | null {
  if (process.env.OPENROUTER_API_KEY) return `openrouter:${MODEL_OPENROUTER}`;
  if (process.env.ANTHROPIC_API_KEY) return `anthropic:${MODEL_ANTHROPIC}`;
  return null;
}

/**
 * Jedno zapytanie do modelu. Zwraca goły tekst odpowiedzi.
 *
 * Cała różnica między dostawcami siedzi tutaj: Anthropic ma osobne pole
 * `system` i treść w `content[]`, OpenRouter (zgodny z OpenAI) wkłada rolę
 * systemową jako pierwszą wiadomość i zwraca `choices[0].message.content`.
 * Wyżej nikt już o tym nie wie.
 */
/**
 * Darmowe modele PROSTO OD OPENROUTERA, zamiast zgadywania identyfikatorów.
 *
 * Lista `MODELE_ZAPASOWE` była wpisana z pamięci i cała poszła na 404 —
 * identyfikatory u OpenRoutera powstają i znikają, więc każda taka lista
 * starzeje się od dnia zapisania. Katalog modeli jest publiczny i nie wymaga
 * klucza, więc pytamy o niego i bierzemy te z zerową ceną.
 *
 * Wynik trzymamy w buforze na dobę: katalog ma ponad trzysta pozycji i nie ma
 * powodu ciągnąć go przy każdej podróży.
 */
async function darmoweModele(): Promise<string[]> {
  try {
    const { cached, TTL } = await import("./cache");
    return await cached("openrouter:free-models:v1", TTL.lookup, async () => {
      const res = await fetch("https://openrouter.ai/api/v1/models", { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) return [];
      const dane = (await res.json()) as { data?: { id: string; pricing?: { prompt?: string; completion?: string } }[] };
      return (dane.data ?? [])
        .filter((m) => Number(m.pricing?.prompt ?? 1) === 0 && Number(m.pricing?.completion ?? 1) === 0)
        // Większe modele najpierw — przy niszowej muzyce mniejsze zwyczajnie
        // nie mają czego zaproponować.
        .map((m) => m.id)
        .sort((a, b) => rozmiar(b) - rozmiar(a))
        .slice(0, 6);
    });
  } catch {
    return [];
  }
}

/** Liczba miliardów parametrów z nazwy modelu; 0, gdy nazwa nic nie mówi. */
function rozmiar(id: string): number {
  return Number(id.match(/(\d+)b\b/i)?.[1] ?? 0);
}

async function zapytaj(system: string, tresc: string): Promise<string> {
  const or = process.env.OPENROUTER_API_KEY;
  const ant = process.env.ANTHROPIC_API_KEY;
  if (!or && !ant) throw new AiError("Brak klucza do modelu (OPENROUTER_API_KEY albo ANTHROPIC_API_KEY).");

  // U Anthropic nie ma czego podmieniać — jeden model, jeden strzał.
  if (!or) return jedenStrzal(system, tresc, MODEL_ANTHROPIC);

  // U OpenRoutera: najpierw model właściwy, potem darmowe, gdy odmówi
  // z powodu pieniędzy albo nieistnienia. Każdy inny błąd przerywa od razu —
  // przy odrzuconym kluczu (401) ponawianie na innym modelu nic nie da.
  /**
   * Najwyżej TRZY podejścia, i to po cichu.
   *
   * Wcześniej portal przebiegał całą listę darmowych modeli, aż któryś
   * odpowiedział. Wychodziło z tego czekanie bez końca i odpowiedzi w trzech
   * różnych jakościach pod rząd — raz sensowna lista, raz polszczyzna z
   * koreańskimi znakami. Dla człowieka po drugiej stronie to ma być JEDNO
   * szukanie, które albo coś znajdzie, albo nie; żadnych skoków, żadnych
   * nazw modeli na ekranie.
   */
  const zKatalogu = await darmoweModele();
  const doProbowania = [...new Set([MODEL_OPENROUTER, ...zKatalogu, ...MODELE_ZAPASOWE])].slice(0, 3);
  let ostatni: AiError | null = null;
  for (const m of doProbowania) {
    try {
      return await jedenStrzal(system, tresc, m);
    } catch (e) {
      if (!(e instanceof AiError) || !e.doPodmiany) throw e;
      ostatni = e;
    }
  }
  throw ostatni ?? new AiError("Szukanie nic nie zwróciło.");
}

/** Jedno podejście do konkretnego modelu. */
async function jedenStrzal(system: string, tresc: string, model: string): Promise<string> {
  const or = process.env.OPENROUTER_API_KEY;
  const ant = process.env.ANTHROPIC_API_KEY;

  const [url, naglowki, body] = or
    ? [
        API_OPENROUTER,
        {
          "content-type": "application/json",
          authorization: `Bearer ${or}`,
          "HTTP-Referer": SKAD,
          "X-Title": "Pure New Shit",
        },
        {
          model,
          max_tokens: 4000,
          messages: [
            { role: "system", content: system },
            { role: "user", content: tresc },
          ],
        },
      ]
    : [
        API_ANTHROPIC,
        {
          "content-type": "application/json",
          "x-api-key": ant!,
          "anthropic-version": "2023-06-01",
        },
        {
          model,
          max_tokens: 4000,
          system,
          messages: [{ role: "user", content: tresc }],
        },
      ];

  const res = await fetch(url, {
    method: "POST",
    headers: naglowki as Record<string, string>,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  }).catch((e) => {
    throw new AiError(`Nie udało się połączyć z modelem: ${e instanceof Error ? e.message : e}`);
  });

  if (!res.ok) {
    const tekst = await res.text().catch(() => "");
    // 404 na modelu to najczęściej literówka albo model niedostępny dla konta;
    // 402 u OpenRoutera to pusty portfel. Mówimy to wprost, bo inaczej jedno
    // i drugie wygląda jak awaria portalu.
    if (res.status === 404) throw new AiError(`Model „${model}" odrzucony: ${tekst.slice(0, 300) || "bez wyjaśnienia"}`, true);
    if (res.status === 402) throw new AiError(`Konto nie ma środków na model „${model}".`, true);
    if (res.status === 429) throw new AiError(`Model „${model}" ma wyczerpany limit.`, true);
    if (res.status === 401) throw new AiError("Klucz do modelu został odrzucony.");
    throw new AiError(`Model odpowiedział błędem ${res.status}. ${tekst.slice(0, 200)}`);
  }

  const dane = (await res.json()) as {
    content?: { type: string; text?: string }[];
    choices?: { message?: { content?: string } }[];
  };
  if (dane.choices) return dane.choices[0]?.message?.content ?? "";
  return (dane.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
}

export class AiError extends Error {
  /** czy warto spróbować innego modelu — brak środków, brak modelu, limit */
  readonly doPodmiany: boolean;
  constructor(message: string, doPodmiany = false) {
    super(message);
    this.doPodmiany = doPodmiany;
  }
}

/** Jedna propozycja od modelu — jeszcze NIEPOTWIERDZONA. */
export interface Propozycja {
  artist: string;
  album: string;
  /** jedno zdanie: dlaczego akurat to, przy tym opisie */
  why: string;
}

/**
 * Prosi model o listę płyt do opisu.
 *
 * `kontekst` to to, co portal wie o człowieku: style z profilu i płyty, które
 * już zna. Bez tego dostajemy odpowiedź, jaką dałby dowolny czat — a cała
 * wartość jest w tym, że my wiemy więcej.
 */
export async function zaproponujPlyty(opis: string, kontekst: {
  style?: string[];
  zna?: string[];
  /** ile pozycji poprosić — bierzemy z zapasem, bo część nie przejdzie weryfikacji */
  ile?: number;
}): Promise<Propozycja[]> {
  const ile = kontekst.ile ?? 15;
  const system = [
    "Jesteś doradcą muzycznym w portalu dla ludzi słuchających metalu, proga i jazzu.",
    "Dostajesz opis tego, czego ktoś chce posłuchać. Zwracasz listę KONKRETNYCH ALBUMÓW.",
    "",
    "Zasady:",
    "- Tylko albumy, które NAPRAWDĘ istnieją. Jeśli nie jesteś pewien tytułu, pomiń pozycję.",
    "- Celuj w rzeczy mniej oczywiste. Nie podawaj płyt, które zna każdy, chyba że opis wprost o nie prosi.",
    "- Różnicuj: nie więcej niż jedna płyta tego samego artysty.",
    "- `why` to JEDNO zdanie po polsku, konkretne — co w tej płycie odpowiada na opis. Bez przymiotników bez pokrycia.",
    "",
    "Odpowiadasz WYŁĄCZNIE danymi JSON, bez komentarza i bez bloku kodu:",
    '{"plyty":[{"artist":"…","album":"…","why":"…"}]}',
    "Nic przed JSON-em i nic po nim.",
  ].join("\n");

  const czesci = [`Opis: ${opis.slice(0, 2000)}`];
  if (kontekst.style?.length) czesci.push(`Style z profilu: ${kontekst.style.slice(0, 20).join(", ")}`);
  if (kontekst.zna?.length) czesci.push(`To już zna — NIE proponuj tego: ${kontekst.zna.slice(0, 60).join("; ")}`);
  czesci.push(`Podaj ${ile} pozycji.`);

  const tekst = await zapytaj(system, czesci.join("\n\n"));
  const wynik = parsujPropozycje(tekst);
  // Zero pozycji to nie jest odpowiedź — to model, który nie zrozumiał zadania.
  if (!wynik.length) throw new AiError("Model nie podał ani jednej płyty.", true);
  return wynik;
}

/** JSON.parse, który zamiast rzucać zwraca null. */
function sprobuj(t: string): unknown {
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

/**
 * Wyciąga tablicę JSON z odpowiedzi.
 *
 * Modele lubią opakować JSON w ```json albo dopisać zdanie przed. Zamiast
 * ufać, że tym razem nie dopiszą, szukamy pierwszego nawiasu kwadratowego.
 */
export function parsujPropozycje(tekst: string): Propozycja[] {
  const dane = wyluskaj(tekst);
  if (dane === null) throw new AiError("Odpowiedź modelu nie jest poprawnym JSON-em.", true);
  const lista = pierwszaTablica(dane);
  if (!lista) throw new AiError("Model nie zwrócił listy.", true);
  return lista
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((x) => ({
      artist: pole(x, ["artist", "artysta", "band", "zespol", "zespół", "wykonawca"]),
      album: pole(x, ["album", "tytul", "tytuł", "title", "plyta", "płyta", "record"]),
      why: pole(x, ["why", "dlaczego", "powod", "powód", "reason", "note"]).slice(0, 400),
    }))
    .filter((p) => p.artist && p.album);
}

/** Pierwsze niepuste z kilku możliwych nazw pola. Modele nie trzymają się jednej. */
function pole(x: Record<string, unknown>, nazwy: string[]): string {
  for (const n of nazwy) {
    const v = x[n];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

/**
 * Wyłuskuje JSON z odpowiedzi — cokolwiek model dokleił dookoła.
 *
 * Kolejność prób jest od najczystszej do najbardziej desperackiej, bo słabsze
 * modele psują to na trzy różne sposoby: opakowują w ```json, dopisują zdanie
 * przed listą albo po prostu urywają się w połowie, gdy skończą im się znaki.
 */
function wyluskaj(tekst: string): unknown {
  const czysty = tekst.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/, "").trim();
  const caly = sprobuj(czysty);
  if (caly !== null) return caly;

  // Nawias klamrowy ALBO kwadratowy — model równie chętnie zwraca obiekt
  // z listą w środku, co samą listę, a wcześniej szukaliśmy tylko listy.
  for (const [o, z] of [["[", "]"], ["{", "}"]] as const) {
    const start = czysty.indexOf(o);
    const koniec = czysty.lastIndexOf(z);
    if (start >= 0 && koniec > start) {
      const d = sprobuj(czysty.slice(start, koniec + 1));
      if (d !== null) return d;
    }
  }

  /**
   * Ratowanie URWANEJ odpowiedzi: ucinamy do ostatniego kompletnego obiektu
   * i domykamy nawias sami. Dziesięć dobrych pozycji jest więcej warte niż
   * komunikat o błędzie dlatego, że jedenasta się nie zmieściła.
   */
  const start = czysty.indexOf("[");
  const ostatni = czysty.lastIndexOf("}");
  if (start >= 0 && ostatni > start) {
    const d = sprobuj(`${czysty.slice(start, ostatni + 1)}]`);
    if (d !== null) return d;
  }
  return null;
}

/** Tablica z danych — wprost albo schowana w którymś polu obiektu. */
function pierwszaTablica(dane: unknown): unknown[] | null {
  if (Array.isArray(dane)) return dane;
  if (dane && typeof dane === "object") {
    for (const v of Object.values(dane as Record<string, unknown>)) {
      if (Array.isArray(v)) return v;
    }
  }
  return null;
}

/** Jedna tura rozmowy — nasza albo jego. */
export interface TuraRozmowy {
  rola: "ja" | "portal";
  tekst: string;
}

export interface OdpowiedzRozmowy {
  odpowiedz: string;
  propozycje: Propozycja[];
}

/**
 * Rozmowa o muzyce — zamiast jednego strzału w gotową listę.
 *
 * DLACZEGO INACZEJ NIŻ „PODRÓŻ W NIEZNANE": tamto z jednego zdania robiło od
 * razu zamkniętą podróż. Jak nie trafiło, zostawało tylko napisać wszystko od
 * nowa. Tu każda odpowiedź jest wynikiem szukania: da się dopytać, zawęzić,
 * pójść w bok — a listę zrobić dopiero z tego, co się uzbierało.
 *
 * Model dostaje CAŁĄ dotychczasową rozmowę w jednej wiadomości. Prosto, ale
 * przenośnie: to samo wychodzi u Anthropic i u OpenRoutera, a portal nie musi
 * znać dwóch formatów historii.
 */
export async function porozmawiaj(
  historia: TuraRozmowy[],
  kontekst: { style?: string[]; zna?: string[] },
): Promise<OdpowiedzRozmowy> {
  const system = [
    "Jesteś rozmówcą w portalu dla ludzi słuchających metalu, proga i jazzu.",
    "Rozmawiasz PO POLSKU, krótko i konkretnie — jak znajomy, który zna się na płytach.",
    "",
    "Zasady:",
    "- Odpowiadasz dwiema–czterema zdaniami. Bez wstępów, bez podsumowań.",
    "- Gdy pytanie prosi o muzykę, dokładasz od 3 do 8 KONKRETNYCH albumów.",
    "- Tylko albumy, które NAPRAWDĘ istnieją. Nie jesteś pewien tytułu — pomijasz.",
    "- Nie powtarzasz płyt, które padły wcześniej w tej rozmowie.",
    "- `why` to jedno zdanie: co w tej płycie odpowiada na pytanie. Bez przymiotników bez pokrycia.",
    "- Gdy ktoś pyta o coś innego niż muzyka, odpowiadasz krótko i wracasz do płyt.",
    "",
    "Odpowiadasz WYŁĄCZNIE danymi JSON, bez komentarza i bez bloku kodu:",
    '{"odpowiedz":"…","plyty":[{"artist":"…","album":"…","why":"…"}]}',
    "Nic przed JSON-em i nic po nim. Gdy nie proponujesz płyt, `plyty` to pusta lista.",
  ].join("\n");

  const czesci: string[] = [];
  if (kontekst.style?.length) czesci.push(`Style z jego profilu: ${kontekst.style.slice(0, 20).join(", ")}`);
  if (kontekst.zna?.length) czesci.push(`To już zna — NIE proponuj tego: ${kontekst.zna.slice(0, 60).join("; ")}`);
  czesci.push(
    ["Rozmowa do tej pory:", ...historia.slice(-12).map((h) => `${h.rola === "ja" ? "ON" : "TY"}: ${h.tekst}`)].join("\n"),
  );
  czesci.push("Odpowiedz na ostatnią wiadomość.");

  const tekst = await zapytaj(system, czesci.join("\n\n"));
  const dane = wyluskaj(tekst);
  if (dane === null) throw new AiError("Odpowiedź modelu nie jest poprawnym JSON-em.", true);
  const obj = (dane && typeof dane === "object" && !Array.isArray(dane) ? dane : {}) as Record<string, unknown>;
  const odpowiedz = pole(obj, ["odpowiedz", "answer", "text", "reply", "message"]).slice(0, 2000);
  const lista = pierwszaTablica(dane) ?? [];
  const propozycje = lista
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((x) => ({
      artist: pole(x, ["artist", "artysta", "band", "zespol", "zespół", "wykonawca"]),
      album: pole(x, ["album", "tytul", "tytuł", "title", "plyta", "płyta", "record"]),
      why: pole(x, ["why", "dlaczego", "powod", "powód", "reason", "note"]).slice(0, 400),
    }))
    .filter((p) => p.artist && p.album);
  // Pusta odpowiedź I pusta lista to nie jest rozmowa — to model, który nie
  // zrozumiał zadania. Warto spróbować innego.
  if (!odpowiedz && !propozycje.length) throw new AiError("Model nie odpowiedział nic sensownego.", true);
  return { odpowiedz, propozycje };
}
