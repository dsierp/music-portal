/**
 * Opisy z Wikipedii. Nie zgadujemy tytułów artykułów — bierzemy je z MusicBrainz
 * (relacja "wikipedia" albo "wikidata" → sitelinks). Preferujemy pl, potem en.
 */
import { cached, TTL } from "./cache";
import type { Links } from "./musicbrainz";

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

const PERSONNEL_HEADING = /skład|twórcy|muzycy|personel|obsada|personnel|musicians?|credits?|line-?up/i;

function cleanWikitext(s: string): string {
  return s
    .replace(/<ref[^>]*\/>/gi, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "")
    .replace(/\{\{[^{}]*\}\}/g, "") // proste szablony (bez zagnieżdżeń)
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1") // [[link|tekst]] / [[tekst]] → tekst
    .replace(/'''?([^']*)'''?/g, "$1") // '''pogrubienie''' / ''kursywa''
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Skład/personel z sekcji Wikipedii (np. "Skład"/"Twórcy" pl, "Personnel" en) —
 * gdy MusicBrainz nie ma jeszcze credits na poziomie nagrań. Zwraca surowe,
 * nieustandaryzowane linie (bez dopasowania do MBID artystów).
 */
export async function wikiPersonnel(lang: string, title: string): Promise<string[] | null> {
  return cached(`wiki:personnel:${lang}:${title}`, TTL.wiki, async () => {
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
      .filter((l) => l.length > 1 && l.length < 200);
    return lines.length ? lines.slice(0, 40) : null;
  });
}

/** Opis dla artysty/płyty na podstawie linków z MusicBrainz. */
export async function wikiFromLinks(links: Links, preferred: string[] = ["pl", "en"]): Promise<WikiSummary | null> {
  const titles: Record<string, string> = {};
  if (links.wikipedia) {
    const m = links.wikipedia.match(/^https?:\/\/([a-z]+)\.wikipedia\.org\/wiki\/(.+)$/);
    if (m) titles[m[1]] = decodeURIComponent(m[2]);
  }
  if (links.wikidata) {
    const q = links.wikidata.match(/(Q\d+)/)?.[1];
    if (q) Object.assign(titles, await sitelinksFor(q));
  }
  for (const lang of preferred) {
    if (titles[lang]) {
      const s = await summary(lang, titles[lang]);
      if (s) return s;
    }
  }
  return null;
}
