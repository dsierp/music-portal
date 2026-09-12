/**
 * Rozmowa o muzyce — stan, tura w tle, potwierdzanie płyt.
 *
 * ZASADA TA SAMA CO WSZĘDZIE: model PROPONUJE, MusicBrainz POTWIERDZA. Płyta,
 * której MusicBrainz nie zna, nie trafia na ekran — bo kliknięcie w nią
 * kończyłoby się w wyszukiwarce, czyli tam, skąd człowiek uciekł.
 *
 * ROBOTA IDZIE W TLE, dokładnie z tego samego powodu co przy podróżach: tura
 * trwa kilkanaście–kilkadziesiąt sekund (model plus jedno zapytanie na sekundę
 * do MusicBrainz), a wcześniej przełączenie karty zrywało żądanie i cała
 * odpowiedź ginęła. Teraz rozmowa ma swój adres: można stąd wyjść i wrócić.
 *
 * Stan siedzi w buforze — to notatka, która MA wygasnąć. Trwałe są dopiero
 * podróże zrobione Z rozmowy, i to jest świadomy podział: rozmowa jest
 * szukaniem, podróż jest tym, co człowiek uznał za warte zapisania.
 */
import { kvGet, kvSet } from "./cache";
import { findAlbumMbid, MbError, type AlbumSummary } from "./musicbrainz";
import type { Propozycja } from "./ai";

export interface Znaleziona {
  album: AlbumSummary;
  why: string;
}

export interface Wiadomosc {
  rola: "ja" | "portal";
  tekst: string;
  /** płyty potwierdzone w MusicBrainz — tylko przy odpowiedziach portalu */
  plyty?: Znaleziona[];
  /** ile propozycji odpadło, bo MusicBrainz ich nie zna */
  odpadlo?: number;
}

export interface Rozmowa {
  id: string;
  userId: string;
  tytul: string;
  wiadomosci: Wiadomosc[];
  /**
   * Co się właśnie dzieje — wiersz po wierszu, tak jak leci.
   *
   * Kręciołek mówi tylko „coś się dzieje". Przy czymś, co trwa pół minuty,
   * człowiek chce wiedzieć CO: że najpierw szukam, a potem sprawdzam kolejne
   * płyty po kolei i która właśnie odpadła. Zapisujemy po każdym kroku, więc
   * ekran (odświeżany co trzy sekundy) pokazuje to na bieżąco.
   */
  postep?: string[];
  stan: "czeka" | "robi" | "blad";
  blad?: string;
  szczegol?: string;
  ostatnia: number;
}

const klucz = (id: string) => `rozmowa:${id}`;

export async function wczytajRozmowe(id: string): Promise<Rozmowa | null> {
  return kvGet<Rozmowa>(klucz(id));
}

async function zapisz(r: Rozmowa) {
  await kvSet(klucz(r.id), { ...r, ostatnia: Date.now() });
}

/**
 * Dokłada wiadomość i odpala turę w tle. Zwraca numer rozmowy — wołający ma
 * tylko przerzucić człowieka pod jej adres.
 */
export async function powiedz(userId: string, tekst: string, id?: string): Promise<string> {
  const { after } = await import("next/server");
  const istniejaca = id ? await wczytajRozmowe(id) : null;
  // Cudza rozmowa nie jest naszą rozmową — zaczynamy nową, zamiast do niej pisać.
  const r: Rozmowa = istniejaca && istniejaca.userId === userId
    ? istniejaca
    : {
        id: crypto.randomUUID(),
        userId,
        tytul: tekst.length > 60 ? `${tekst.slice(0, 57)}…` : tekst,
        wiadomosci: [],
        stan: "czeka",
        ostatnia: Date.now(),
      };
  r.wiadomosci.push({ rola: "ja", tekst });
  r.stan = "robi";
  r.postep = ["szukam"];
  r.blad = undefined;
  r.szczegol = undefined;
  await zapisz(r);
  after(async () => {
    await tura(r.id, userId);
  });
  return r.id;
}

async function tura(id: string, userId: string) {
  const r = await wczytajRozmowe(id);
  if (!r) return;
  /** Dopisuje wiersz postępu i od razu go zapisuje — ekran czyta na bieżąco. */
  const krok = async (linia: string) => {
    r.postep = [...(r.postep ?? []), linia];
    await zapisz(r);
  };
  try {
    const { porozmawiaj, AiError } = await import("./ai");
    const ud = await import("./user-data");
    const style = (await ud.getGenres(userId).catch(() => [])).map((g) => g.genre);
    const zna = (await ud.getLikedAlbums(userId).catch(() => [])).map((a) => `${a.artistName} – ${a.title}`);

    let odp;
    try {
      odp = await porozmawiaj(
        r.wiadomosci.map((w) => ({ rola: w.rola, tekst: w.tekst })),
        { style, zna },
      );
    } catch (e) {
      const aiBlad = e instanceof AiError;
      if (!aiBlad) console.error("rozmowa:", e);
      await zapisz({
        ...r,
        postep: undefined,
        stan: "blad",
        blad: aiBlad ? "model" : "nieznany",
        szczegol: e instanceof Error ? e.message : String(e),
      });
      return;
    }

    // Płyty, które już padły w tej rozmowie — model bywa uparty i wraca do
    // tych samych, a wtedy lista wyników przestaje być wynikiem szukania.
    const juz = new Set(
      r.wiadomosci.flatMap((w) => (w.plyty ?? []).map((p) => p.album.mbid)),
    );
    const { plyty, odpadlo, awaria } = await potwierdz(odp.propozycje, juz, krok);
    r.wiadomosci.push({ rola: "portal", tekst: odp.odpowiedz, plyty, odpadlo });
    // Awaria MusicBrainz to nie jest „nie ma takich płyt" — mówimy to wprost,
    // zamiast pokazywać pustą odpowiedź i dać człowiekowi myśleć, że model
    // nic nie wymyślił.
    await zapisz({
      ...r,
      postep: undefined,
      stan: awaria && !plyty.length ? "blad" : "czeka",
      blad: awaria && !plyty.length ? "mbAwaria" : undefined,
    });
  } catch (e) {
    console.error("rozmowa (poza obsługą):", e);
    await zapisz({ ...r, stan: "blad", blad: "nieznany", szczegol: e instanceof Error ? e.message : String(e) });
  }
}

/** Sprawdza propozycje w MusicBrainz. Chodzimy po kolei — jedno zapytanie na sekundę. */
async function potwierdz(
  propozycje: Propozycja[],
  juz: Set<string>,
  krok?: (linia: string) => Promise<void>,
): Promise<{ plyty: Znaleziona[]; odpadlo: number; awaria: boolean }> {
  const plyty: Znaleziona[] = [];
  let odpadlo = 0;
  let awaria = false;
  for (const p of propozycje.slice(0, 8)) {
    await krok?.(`sprawdzam::${p.artist} – ${p.album}`);
    let znaleziony: AlbumSummary | null = null;
    try {
      znaleziony = await findAlbumMbid(p.artist, p.album);
    } catch (e) {
      awaria = true;
      if (!(e instanceof MbError)) console.error("rozmowa/MusicBrainz:", e);
    }
    if (!znaleziony) {
      odpadlo++;
      await krok?.(`brak::${p.artist} – ${p.album}`);
      continue;
    }
    if (juz.has(znaleziony.mbid)) continue;
    juz.add(znaleziony.mbid);
    plyty.push({ album: znaleziony, why: p.why });
    await krok?.(`mam::${znaleziony.artistText} – ${znaleziony.title}`);
  }
  return { plyty, odpadlo, awaria };
}

/** Wszystkie potwierdzone płyty z rozmowy — materiał na podróż. */
export function plytyZRozmowy(r: Rozmowa): Znaleziona[] {
  const widziane = new Set<string>();
  const out: Znaleziona[] = [];
  for (const w of r.wiadomosci) {
    for (const p of w.plyty ?? []) {
      if (widziane.has(p.album.mbid)) continue;
      widziane.add(p.album.mbid);
      out.push(p);
    }
  }
  return out;
}
