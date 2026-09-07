/**
 * Opisy z Wikipedii. Nie zgadujemy tytułów artykułów — bierzemy je z MusicBrainz
 * (relacja "wikipedia" albo "wikidata" → sitelinks). Preferujemy pl, potem en.
 */
import { cached, TTL } from "./cache";
import type { Links } from "./musicbrainz";
import { PERSONNEL_HEADING, cleanWikitext, splitPersonnelLine, parseRatingsTemplate } from "./wikitext";
export { parseRatingsTemplate } from "./wikitext";
import type { PersonnelLine, WikiReview } from "./wikitext";
export type { PersonnelLine, WikiReview } from "./wikitext";

const UA = process.env.MUSICBRAINZ_USER_AGENT ?? "MusicPortal/0.1 (dev)";

export interface WikiSummary {
  lang: string;
  title: string;
  extract: string;
  url: string;
  thumbnail: string | null;
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

/** Tytuły artykułów {lang: title} dla encji Wikidata. */
async function sitelinksFor(qid: string): Promise<Record<string, string>> {
  return cached(`wd:${qid}`, TTL.wiki, async () => {
    const data = await getJson<{ entities: Record<string, { sitelinks?: Record<string, { title: string }> }> }>(
      `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`,
    );
    const links = data?.entities?.[qid]?.sitelinks ?? {};
    const out: Record<string, string> = {};
    for (const [site, v] of Object.entries(links)) {
      const m = site.match(/^([a-z]+)wiki$/);
      if (m) out[m[1]] = v.title;
    }
    return out;
  });
}

async function summary(lang: string, title: string): Promise<WikiSummary | null> {
  return cached(`wiki:${lang}:${title}`, TTL.wiki, async () => {
    const data = await getJson<{ title: string; extract?: string; content_urls?: { desktop: { page: string } }; thumbnail?: { source: string } }>(
      `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`,
    );
    if (!data?.extract) return null;
    return {
      lang,
      title: data.title,
      extract: data.extract,
      url: data.content_urls?.desktop.page ?? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`,
      thumbnail: data.thumbnail?.source ?? null,
    };
  });
}

/**
 * Skład/personel z sekcji Wikipedii (np. "Skład"/"Twórcy" pl, "Personnel" en) —
 * gdy MusicBrainz nie ma jeszcze credits na poziomie nagrań. Rozbite na nazwisko
 * + role, żeby dało się nazwiska dopasować do artystów w MB i zrobić z nich linki.
 */
export async function wikiPersonnel(lang: string, title: string): Promise<PersonnelLine[] | null> {
  // v2 — zmieniony kształt danych, stary cache (same stringi) trzeba ominąć.
  return cached(`wiki:personnel:v2:${lang}:${title}`, TTL.wiki, async () => {
    const sections = await getJson<{ parse?: { sections?: { index: string; line: string; anchor: string }[] } }>(
      `https://${lang}.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=sections&format=json&formatversion=2`,
    );
    const section = sections?.parse?.sections?.find((s) => PERSONNEL_HEADING.test(s.line));
    if (!section) return null;
    const body = await getJson<{ parse?: { wikitext?: string } }>(
      `https://${lang}.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&section=${section.index}&prop=wikitext&format=json&formatversion=2`,
    );
    const wikitext = body?.parse?.wikitext ?? "";
    const lines = wikitext
      .split("\n")
      .filter((l) => /^\*/.test(l.trim()))
      .map((l) => cleanWikitext(l.replace(/^\*+/, "")))
      .filter((l) => l.length > 1 && l.length < 200)
      .map(splitPersonnelLine)
      .filter((l): l is PersonnelLine => !!l);
    return lines.length ? lines.slice(0, 40) : null;
  });
}

/** Wszystkie znane tytuły artykułu {lang: title} — do prób w kilku językach. */
async function titlesFromLinks(links: Links): Promise<Record<string, string>> {
  const titles: Record<string, string> = {};
  if (links.wikipedia) {
    const m = links.wikipedia.match(/^https?:\/\/([a-z]+)\.wikipedia\.org\/wiki\/(.+)$/);
    if (m) titles[m[1]] = decodeURIComponent(m[2]);
  }
  if (links.wikidata) {
    const q = links.wikidata.match(/(Q\d+)/)?.[1];
    if (q) Object.assign(titles, await sitelinksFor(q));
  }
  return titles;
}

/**
 * Oceny prasowe płyty. Próbuje kolejnych języków — angielska Wikipedia ma ten
 * szablon zdecydowanie najczęściej, więc jest pierwsza mimo polskiego interfejsu.
 */
export async function wikiAlbumRatings(links: Links, preferred: string[] = ["en", "pl"]): Promise<WikiReview[]> {
  const titles = await titlesFromLinks(links);
  for (const lang of preferred) {
    const title = titles[lang];
    if (!title) continue;
    const reviews = await cached(`wiki:ratings:v1:${lang}:${title}`, TTL.wiki, async () => {
      const body = await getJson<{ parse?: { wikitext?: string } }>(
        `https://${lang}.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=wikitext&format=json&formatversion=2`,
      );
      return parseRatingsTemplate(body?.parse?.wikitext ?? "");
    });
    if (reviews.length) return reviews;
  }
  return [];
}

/**
 * Logo zespołu z Wikidata (własność P154 „logo image"). Wikidata trzyma logo
 * osobno od zdjęcia zespołu (P18), więc dostajemy to, o co chodzi: znak
 * zespołu, a nie przypadkowe zdjęcie z koncertu.
 *
 * Zwraca adres pliku w Wikimedia Commons przeskalowany do podanej szerokości —
 * oryginały bywają wielkimi PNG-ami, a w nagłówku i tak potrzeba kilkuset pikseli.
 * Brak logo w Wikidata = null; nie szukamy zamienników, bo „prawie logo" gorsze
 * niż nic.
 */
export async function wikiLogo(links: Links, width = 480): Promise<string | null> {
  const qid = links.wikidata?.match(/(Q\d+)/)?.[1];
  if (!qid) return null;
  const file = await cached(`wd:logo:${qid}`, TTL.wiki, async () => {
    const data = await getJson<{ entities: Record<string, { claims?: Record<string, { mainsnak?: { datavalue?: { value?: string } } }[]> }> }>(
      `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`,
    );
    const claims = data?.entities?.[qid]?.claims;
    const name = claims?.P154?.[0]?.mainsnak?.datavalue?.value;
    return typeof name === "string" ? name : null;
  });
  if (!file) return null;
  // Special:FilePath z parametrem width oddaje gotową miniaturę z Commons.
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${width}`;
}

/** Opis dla artysty/płyty na podstawie linków z MusicBrainz. */
export async function wikiFromLinks(links: Links, preferred: string[] = ["pl", "en"]): Promise<WikiSummary | null> {
  const titles = await titlesFromLinks(links);
  for (const lang of preferred) {
    if (titles[lang]) {
      const s = await summary(lang, titles[lang]);
      if (s) return s;
    }
  }
  return null;
}
