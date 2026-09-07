import Link from "next/link";
import type { InferSelectModel } from "drizzle-orm";
import { schema } from "@/db";
import { FLAG_LABELS, GENRE_LABELS } from "@/lib/lists";
import { searchLinks } from "./links";

type Release = InferSelectModel<typeof schema.releases>;

/**
 * Płyta tygodnia i pozostałe wyróżnienia.
 *
 * Klasy (.pick, .rel, .cover, .eyebrow…) pochodzą z oryginalnego arkusza
 * „Pure New Shit" przeniesionego do src/app/pns.css — dzięki temu układ,
 * proporcje i typografia są tam takie same, a nie odtworzone na oko.
 */
const CAA = (mbid: string, px: 250 | 500) => `https://coverartarchive.org/release-group/${mbid}/front-${px}`;

export function PickCard({ r }: { r: Release }) {
  const links = searchLinks(r.artist ?? "", r.album ?? "");
  const href = `/go/release/${encodeURIComponent(r.id)}`;
  return (
    <article className="pick has-cover">
      <Link href={href} className="cover block">
        {r.mbid ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={CAA(r.mbid, 500)} alt="" loading="lazy" />
        ) : (
          <div className="ph">{(r.artist ?? "?").trim().charAt(0).toUpperCase()}</div>
        )}
      </Link>
      <div>
        <p className="eyebrow">Płyta tygodnia{r.genre && ` · ${GENRE_LABELS[r.genre] ?? r.genre}`}</p>
        <p className="who">{r.artist}</p>
        <h3 className="what">
          <Link href={href} className="hover:text-accent2">{r.album}</Link>
        </h3>
        {r.label && <p className="meta"><b>{r.label}</b></p>}
        <p className="desc rich" dangerouslySetInnerHTML={{ __html: r.description }} />
        {r.reviews && (
          <p className="rev rich">
            <span className="k">Recenzje</span>
            <span dangerouslySetInnerHTML={{ __html: r.reviews }} />
          </p>
        )}
        <div className="row">
          <Actions links={links} href={href} />
        </div>
      </div>
    </article>
  );
}

export function ReleaseCard({ r }: { r: Release }) {
  if (r.star === -1) {
    return (
      <li className="rel">
        <span />
        <div className="body">
          <p className="desc rich" dangerouslySetInnerHTML={{ __html: r.description }} />
        </div>
      </li>
    );
  }
  const links = searchLinks(r.artist ?? "", r.album ?? "");
  const href = `/go/release/${encodeURIComponent(r.id)}`;
  return (
    <li className={`rel ${r.star === 1 ? "star" : ""}`}>
      <Link href={href} className="shrink-0" aria-hidden tabIndex={-1}>
        {r.mbid ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={CAA(r.mbid, 250)} alt="" loading="lazy" className="h-[76px] w-[76px] rounded object-cover shadow-lg" />
        ) : (
          <span className="display flex h-[76px] w-[76px] items-center justify-center rounded border border-rule bg-surface2 text-2xl text-faint">
            {(r.artist ?? "?").trim().charAt(0).toUpperCase()}
          </span>
        )}
      </Link>
      <div className="body">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
          {r.star === 1 && <span className="text-accent2">★ wyróżnienie · </span>}
          {GENRE_LABELS[r.genre] ?? r.genre}
          {r.flag && <span className="ml-2 text-warn">{FLAG_LABELS[r.flag] ?? r.flag}</span>}
          {r.dayLabel && <span className="ml-2 text-faint">{r.dayLabel}</span>}
        </p>
        <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-text2">{r.artist}</p>
        <h3 className="display text-2xl italic leading-tight">
          <Link href={href} className="hover:text-accent2">{r.album}</Link>
        </h3>
        {r.label && <p className="text-xs text-muted">{r.label}</p>}
        <p className="desc rich" dangerouslySetInnerHTML={{ __html: r.description }} />
        {r.reviews && (
          <p className="rev rich">
            <span className="k">Recenzje</span>
            <span dangerouslySetInnerHTML={{ __html: r.reviews }} />
          </p>
        )}
        <div className="side">
          <Actions links={links} href={href} small />
        </div>
      </div>
    </li>
  );
}

function Actions({ links, href, small = false }: { links: { spotify: string; tidal: string }; href: string; small?: boolean }) {
  const pill = "rounded-full border px-3 py-1 font-mono transition-colors";
  return (
    <div className={`flex flex-wrap items-center gap-2 ${small ? "text-[11px]" : "text-xs"}`}>
      <a href={links.spotify} target="_blank" rel="noopener" className={`${pill} border-spotify/40 text-spotify hover:bg-spotify/10`}>▶ Spotify</a>
      <a href={links.tidal} target="_blank" rel="noopener" className={`${pill} border-tidal/40 text-tidal hover:bg-tidal/10`}>▶ Tidal</a>
      <Link href={href} className={`${pill} border-rule text-muted hover:border-accent2 hover:text-accent2`}>skład i podróż →</Link>
    </div>
  );
}
