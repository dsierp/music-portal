/**
 * Model językowy — jedyne miejsce w portalu, które go woła.
 *
 * ZASADA, KTÓREJ NIE WOLNO ZŁAMAĆ: model PROPONUJE, MusicBrainz POTWIERDZA.
 * Model potrafi podać płytę, której nie ma — z przekonującym opisem, rokiem
 * wydania i nazwą wytwórni. Dlatego nic, co stąd wyjdzie, nie trafia na ekran
 * bez przejścia przez `findAlbumMbid`. Portal z założenia nie buduje własnej
 * bazy wiedzy; tu też nie zaczynamy.
 *
 * Klucz siedzi w ANTHROPIC_API_KEY (Vercel → Settings → Environment Variables
 * albo .env.local na maszynie). Bez klucza portal działa normalnie — ekran
 * „w nieznane" po prostu mówi, że jest nieskonfigurowany, zamiast się wywalać.
 */

/** Model do zmiany bez ruszania kodu — gdyby konto nie miało akurat tego. */
const MODEL = process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest";
const API = "https://api.anthropic.com/v1/messages";

export function aiSkonfigurowane(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export class AiError extends Error {}

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
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new AiError("Brak ANTHROPIC_API_KEY.");

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
    "Odpowiadasz WYŁĄCZNIE tablicą JSON, bez komentarza i bez bloku kodu:",
    '[{"artist":"…","album":"…","why":"…"}]',
  ].join("\n");

  const czesci = [`Opis: ${opis.slice(0, 2000)}`];
  if (kontekst.style?.length) czesci.push(`Style z profilu: ${kontekst.style.slice(0, 20).join(", ")}`);
  if (kontekst.zna?.length) czesci.push(`To już zna — NIE proponuj tego: ${kontekst.zna.slice(0, 60).join("; ")}`);
  czesci.push(`Podaj ${ile} pozycji.`);

  const res = await fetch(API, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      system,
      messages: [{ role: "user", content: czesci.join("\n\n") }],
    }),
    signal: AbortSignal.timeout(60_000),
  }).catch((e) => {
    throw new AiError(`Nie udało się połączyć z modelem: ${e instanceof Error ? e.message : e}`);
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // 404 na modelu to najczęściej literówka albo model niedostępny dla konta —
    // mówimy to wprost, bo inaczej wygląda jak awaria portalu.
    throw new AiError(
      res.status === 404
        ? `Model „${MODEL}" jest niedostępny dla tego klucza. Ustaw ANTHROPIC_MODEL na inny.`
        : `Model odpowiedział błędem ${res.status}. ${body.slice(0, 200)}`,
    );
  }

  const dane = (await res.json()) as { content?: { type: string; text?: string }[] };
  const tekst = (dane.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
  return parsujPropozycje(tekst);
}

/**
 * Wyciąga tablicę JSON z odpowiedzi.
 *
 * Modele lubią opakować JSON w ```json albo dopisać zdanie przed. Zamiast
 * ufać, że tym razem nie dopiszą, szukamy pierwszego nawiasu kwadratowego.
 */
export function parsujPropozycje(tekst: string): Propozycja[] {
  const start = tekst.indexOf("[");
  const koniec = tekst.lastIndexOf("]");
  if (start < 0 || koniec < start) throw new AiError("Model nie zwrócił listy.");
  let dane: unknown;
  try {
    dane = JSON.parse(tekst.slice(start, koniec + 1));
  } catch {
    throw new AiError("Odpowiedź modelu nie jest poprawnym JSON-em.");
  }
  if (!Array.isArray(dane)) throw new AiError("Model nie zwrócił listy.");
  return dane
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((x) => ({
      artist: String(x.artist ?? "").trim(),
      album: String(x.album ?? "").trim(),
      why: String(x.why ?? "").trim().slice(0, 400),
    }))
    .filter((p) => p.artist && p.album);
}
