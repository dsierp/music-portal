import Link from "next/link";
import type { InferSelectModel } from "drizzle-orm";
import { schema } from "@/db";
import { searchLinks } from "./links";
import type { Dict } from "@/lib/dict";

type Entry = InferSelectModel<typeof schema.bestOfEntries>;

/**
 * Best of prezentowany tak samo jak premiery: numer 1 w kategorii dostaje dużą
 * okładkę i typografię płyty tygodnia, reszta idzie gęstą listą.
 *
 * Klasy pochodzą z tego samego arkusza (pns.css), więc obie strony wyglądają
 * jak jedno wydawnictwo, a nie jak dwa różne projekty.
 */
const CAA = (mbid: string, px: 250 | 500) => `https://coverartarchive.org/release-group/${mbid}/front-${px}`;

function meta(e: Entry) {
  return [e.label, e.genre, e.country, e.released].filter(Boolean).join(" · ");
}

/** Pozycja nr 1 w kategorii — duża okładka, jak płyta tygodnia w premierach. */
export function BestPick({ e, category, t }: { e: Entry; category: string; t: Dict }) {
  const links = searchLinks(e.artist, e.album);
  const href = `/go/best/${e.id}`;
  return (
    <article className="pick has-cover">
      <Link href={href} className="cover block">
        {e.mbid ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={CAA(e.mbid, 500)} alt="" loading="lazy" />
        ) : (
          <div className="ph">{e.artist.trim().charAt(0).toUpperCase()}</div>
        )}
      </Link>
      <div>
        <p className="eyebrow">{t.lists.numberOne} · {category}</p>
        <p className="who">{e.artist}</p>
        <h3 className="what">
          <Link href={href} className="hover:text-accent2">{e.album}</Link>
        </h3>
        {meta(e) && <p className="meta">{meta(e)}</p>}
        {e.why && <p className="desc">{e.why}</p>}
        {e.scores && (
          <p className="rev">
            <span className="k">{t.lists.ratingsLabel}</span>
            {e.scores}
          </p>
        )}
        <div className="row">
          <Actions links={links} href={href} t={t} />
        </div>
      </div>
    </article>
  );
}

/** Pozostałe miejsca — wiersz z numerem zamiast gwiazdki. */
export function BestRow({ e, t }: { e: Entry; t: Dict }) {
  const links = searchLinks(e.artist, e.album);
  const href = `/go/best/${e.id}`;
  return (
    <li className="rel">
      <span className="display text-right text-lg text-faint">{e.rank}</span>
      <div className="body">
        <h3 className="title display">
          <Link href={href} className="font-semibold hover:text-accent2">{e.artist}</Link>
          <span className="sep">–</span>
          <Link href={href} className="italic hover:text-accent2">{e.album}</Link>
          {meta(e) && <span className="label-inline">{meta(e)}</span>}
        </h3>
        {e.why && <p className="desc">{e.why}</p>}
        {e.scores && (
          <p className="rev">
            <span className="k">{t.lists.ratingsLabel}</span>
            {e.scores}
          </p>
        )}
      </div>
      <div className="side">
        <Actions links={links} href={href} t={t} small />
      </div>
    </li>
  );
}

function Actions({ links, href, t, small = false }: { links: { spotify: string; tidal: string }; href: string; t: Dict; small?: boolean }) {
  const pill = "rounded-full border px-3 py-1 font-mono transition-colors";
  return (
    <div className={`flex flex-wrap items-center gap-2 ${small ? "text-[11px]" : "text-xs"}`}>
      <a href={links.spotify} target="_blank" rel="noopener" className={`${pill} border-spotify/40 text-spotify hover:bg-spotify/10`}>▸ Spotify</a>
      <a href={links.tidal} target="_blank" rel="noopener" className={`${pill} border-tidal/40 text-tidal hover:bg-tidal/10`}>⌕ Tidal</a>
      <Link href={href} className={`${pill} border-rule text-muted hover:border-accent2 hover:text-accent2`}>{t.releases.travelCta}</Link>
    </div>
  );
}
