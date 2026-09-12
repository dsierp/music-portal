/**
 * Układanie podróży W TLE — bo wcześniej ginęło, gdy człowiek odszedł od ekranu.
 *
 * TAK TO WYGLĄDAŁO: cała robota (model + weryfikacja kilkunastu pozycji
 * w MusicBrainz, razem około pół minuty) działa się WEWNĄTRZ wysłania
 * formularza. Wystarczyło w tym czasie przełączyć kartę albo kliknąć gdzie
 * indziej — przeglądarka zrywała żądanie, funkcja padała razem z nim i po
 * podróży nie zostawał nawet ślad. Człowiek wracał do pustego formularza.
 *
 * TERAZ: wysłanie formularza tylko ZAKŁADA zadanie i od razu przerzuca na
 * ekran czekania. Właściwa robota leci w `after()`, czyli już po odesłaniu
 * odpowiedzi — nie zależy od tego, czy ktoś patrzy. Ekran czekania odświeża
 * się sam i przejmuje gotową podróż, choćby człowiek wrócił do niej za pięć
 * minut z drugiego urządzenia.
 *
 * Stan trzymamy w tym samym buforze co resztę — to notatka, która MA wygasnąć.
 */
import { kvGet, kvSet, podbijLicznik } from "./cache";
import * as ud from "./user-data";

export type StanZadania =
  | { stan: "robi"; opis: string; start: number }
  | { stan: "gotowe"; opis: string; listId: string }
  | { stan: "blad"; opis: string; blad: string; szczegol?: string };

const klucz = (id: string) => `zadanie:podroz:${id}`;

export async function stanPodrozy(id: string): Promise<StanZadania | null> {
  return kvGet<StanZadania>(klucz(id));
}

/**
 * Zakłada zadanie i wraca NATYCHMIAST z jego numerem. Sama robota idzie
 * w tle — wołający ma tylko przerzucić człowieka na ekran czekania.
 */
export async function zacznijPodroz(userId: string, opis: string): Promise<string> {
  const { after } = await import("next/server");
  const id = crypto.randomUUID();
  await kvSet(klucz(id), { stan: "robi", opis, start: Date.now() } satisfies StanZadania);
  after(async () => {
    await wykonaj(id, userId, opis);
  });
  return id;
}

async function wykonaj(id: string, userId: string, opis: string) {
  const zapisz = (s: StanZadania) => kvSet(klucz(id), s);
  try {
    const { ulozPodroz } = await import("./podroz-nieznane");
    const { AiError } = await import("./ai");
    const style = (await ud.getGenres(userId).catch(() => [])).map((g) => g.genre);
    // Co już zna: ulubione i ocenione. Bez tego model proponuje rzeczy, które
    // ten człowiek ma na półce od dwudziestu lat.
    const zna = (await ud.getLikedAlbums(userId).catch(() => [])).map((a) => `${a.artistName} – ${a.title}`);

    let wynik;
    try {
      wynik = await ulozPodroz(opis, { style, zna });
    } catch (e) {
      // Szczegół idzie NA EKRAN, a nie tylko do logów: „odrzucony klucz",
      // „brak środków" i „zły model" to trzy różne rzeczy do zrobienia.
      const aiBlad = e instanceof AiError;
      if (!aiBlad) console.error("podroz w tle:", e);
      await zapisz({
        stan: "blad",
        opis,
        blad: aiBlad ? "model" : "nieznany",
        szczegol: e instanceof Error ? e.message : String(e),
      });
      return;
    }
    if (!wynik.przystanki.length) {
      await zapisz({ stan: "blad", opis, blad: wynik.awaria ? "mbAwaria" : "pusto" });
      return;
    }

    // Licznik podbijamy dopiero po UDANYM ułożeniu — nieudana próba nie ma
    // zjadać komuś dziennego limitu.
    await podbijLicznik(userId, "nieznane");
    const tytul = opis.length > 60 ? `${opis.slice(0, 57)}…` : opis;
    const lista = await ud.createList(userId, tytul, opis);
    for (const p of wynik.przystanki) {
      await ud
        .addToList(userId, lista.id, {
          targetType: "ALBUM",
          targetMbid: p.album.mbid,
          label: `${p.album.artistText} – ${p.album.title}`.trim(),
          note: p.why || null,
        })
        .catch(() => {});
    }
    await zapisz({ stan: "gotowe", opis, listId: lista.id });
  } catch (e) {
    console.error("podroz w tle (poza obsługą):", e);
    await zapisz({ stan: "blad", opis, blad: "nieznany", szczegol: e instanceof Error ? e.message : String(e) });
  }
}

/**
 * Zamiana płyt na KAWAŁKI — po kilka z każdej, z prawdziwej tracklisty.
 *
 * Idzie w tle z tego samego powodu co reszta: tracklista każdej płyty to
 * zapytanie do MusicBrainz (jedno na sekundę), a potem jeszcze model. Przy
 * dziesięciu płytach to pół minuty i nie ma prawa zginąć, gdy ktoś odejdzie
 * od ekranu. Wynik trafia pod ten sam ekran czekania, co podróże.
 */
export async function zacznijKawalki(
  userId: string,
  tytul: string,
  plyty: { mbid: string; label: string }[],
  ile = 2,
): Promise<string> {
  const { after } = await import("next/server");
  const id = crypto.randomUUID();
  await kvSet(klucz(id), { stan: "robi", opis: tytul, start: Date.now() } satisfies StanZadania);
  after(async () => {
    await wykonajKawalki(id, userId, tytul, plyty, ile);
  });
  return id;
}

async function wykonajKawalki(
  id: string,
  userId: string,
  tytul: string,
  plyty: { mbid: string; label: string }[],
  ile: number,
) {
  const zapisz = (s: StanZadania) => kvSet(klucz(id), s);
  try {
    const { getAlbum } = await import("./musicbrainz");
    const { wybierzKawalki, AiError } = await import("./ai");

    // Prawdziwe tracklisty. Płyta, której MusicBrainz nie odda, po prostu
    // wypada — lepiej krótsza trasa niż przystanek, w który nie da się wejść.
    const zbior: { artysta: string; album: string; utwory: { tytul: string; mbid: string }[] }[] = [];
    for (const p of plyty.slice(0, 15)) {
      const album = await getAlbum(p.mbid).catch(() => null);
      if (!album?.tracks?.length) continue;
      zbior.push({
        artysta: album.artistText,
        album: album.title,
        utwory: album.tracks
          .filter((t) => t.recordingMbid)
          .map((t) => ({ tytul: t.title, mbid: t.recordingMbid! })),
      });
    }
    if (!zbior.length) {
      await zapisz({ stan: "blad", opis: tytul, blad: "mbAwaria" });
      return;
    }

    let wybor;
    try {
      wybor = await wybierzKawalki(
        zbior.map((z) => ({ artysta: z.artysta, album: z.album, utwory: z.utwory.map((u) => u.tytul) })),
        ile,
      );
    } catch (e) {
      const aiBlad = e instanceof AiError;
      if (!aiBlad) console.error("kawalki:", e);
      await zapisz({ stan: "blad", opis: tytul, blad: aiBlad ? "model" : "nieznany", szczegol: e instanceof Error ? e.message : String(e) });
      return;
    }

    // Tytuł z odpowiedzi wracamy na MBID. Porównujemy luźno, bo modele gubią
    // wielkość liter, nawiasy i znaki diakrytyczne — ale jeśli nic nie pasuje,
    // pozycja wypada. Nie zgadujemy „chodziło mu pewnie o ten".
    const luzno = (s: string) => s.toLowerCase().replace(/[^a-z0-9ąćęłńóśźż]+/gi, "");
    const przystanki: { mbid: string; label: string; note: string }[] = [];
    const widziane = new Set<string>();
    for (const w of wybor) {
      const p = zbior[w.plyta];
      if (!p) continue;
      const u = p.utwory.find((x) => luzno(x.tytul) === luzno(w.tytul)) ?? p.utwory.find((x) => luzno(x.tytul).startsWith(luzno(w.tytul)));
      if (!u || widziane.has(u.mbid)) continue;
      widziane.add(u.mbid);
      przystanki.push({ mbid: u.mbid, label: `${p.artysta} – ${u.tytul}`, note: w.why });
    }
    // Gdy model kompletnie nie trafił, bierzemy po prostu pierwsze utwory —
    // pusta lista byłaby gorsza niż lista bez uzasadnień.
    if (!przystanki.length) {
      for (const p of zbior) {
        for (const u of p.utwory.slice(0, ile)) {
          if (widziane.has(u.mbid)) continue;
          widziane.add(u.mbid);
          przystanki.push({ mbid: u.mbid, label: `${p.artysta} – ${u.tytul}`, note: "" });
        }
      }
    }

    await podbijLicznik(userId, "nieznane");
    const lista = await ud.createList(userId, tytul, null);
    for (const p of przystanki) {
      await ud
        .addToList(userId, lista.id, { targetType: "RECORDING", targetMbid: p.mbid, label: p.label, note: p.note || null })
        .catch(() => {});
    }
    await zapisz({ stan: "gotowe", opis: tytul, listId: lista.id });
  } catch (e) {
    console.error("kawalki (poza obsługą):", e);
    await zapisz({ stan: "blad", opis: tytul, blad: "nieznany", szczegol: e instanceof Error ? e.message : String(e) });
  }
}
