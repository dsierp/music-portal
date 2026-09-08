import Link from "next/link";
import type { InferSelectModel } from "drizzle-orm";
import { schema } from "@/db";
import { searchLinks } from "./links";
import { genreLabel as genreLabelFallback } from "@/lib/lists";
import { genreLabel } from "@/lib/dict";
import type { Dict } from "@/lib/dict";

type Release = InferSelectModel<typeof schema.releases>;

/**
 * Płyta tygodnia i pozostałe wyróżnienia.
 *
 * Klasy (.pick, .rel, .cover, .eyebrow…) pochodzą z oryginalnego arkusza
 * „Pure New Shit" przeniesionego do src/app/pns.css — dzięki temu układ,
 * proporcje i typografia są tam takie same, a nie odtworzone na oko.
 */
const CAA = (mbid: string, px: 250 | 500) => `https://coverartarchive.org/release-group/${mbid}/front-${px}`;

export function PickCard({ r, t }: { r: Release; t: Dict }) {
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
        <p className="eyebrow">{t.releases.weekPick}{r.genre && ` · ${genreLabel(r.genre, t, genreLabelFallback(r.genre))}`}</p>
        <p className="who">{r.artist}</p>
        <h3 className="what">
          <Link href={href} className="hover:text-accent2">{r.album}</Link>
        </h3>
        {r.label && <p className="meta"><b>{r.label}</b></p>}
        <p className="desc rich" dangerouslySetInnerHTML={{ __html: r.description }} />
        {r.reviews && (
          <p className="rev rich">
            <span className="k">{t.releases.reviews}</span>
            <span dangerouslySetInnerHTML={{ __html: r.reviews }} />
          </p>
        )}
        <div className="row">
          <Actions links={links} href={href} t={t} />
        </div>
      </div>
    </article>
  );
}

/** Etykiety flag (EP, reedycja…) — tłumaczone tu, bo lista wartości w schemacie zostaje po polsku. */
const FLAG_KEYS: Record<string, keyof Dict["releases"]> = { ep: "flagEp", comp: "flagComp", reissue: "flagReissue", live: "flagLive", instr: "flagInstr" };

export function ReleaseCard({ r, t }: { r: Release; t: Dict }) {
  if (r.star === -1) {
    return (
      <li className="rel">
        <span className="text-faint">·</span>
        <div className="body">
          <p className="desc rich" dangerouslySetInnerHTML={{ __html: r.description }} />
        </div>
      </li>
    );
  }
  const links = searchLinks(r.artist ?? "", r.album ?? "");
  const href = `/go/release/${encodeURIComponent(r.id)}`;
  const flagKey = r.flag ? FLAG_KEYS[r.flag] : undefined;
  return (
    <li className={`rel ${r.star === 1 ? "star" : ""}`}>
      {/* wąska kolumna na gwiazdkę — jak w oryginalnym zestawieniu */}
      <span className={r.star === 1 ? "text-accent2" : "text-faint"}>{r.star === 1 ? "★" : "·"}</span>
      <div className="body">
        <h3 className="title display">
          <Link href={href} className="font-semibold hover:text-accent2">{r.artist}</Link>
          <span className="sep">–</span>
          <Link href={href} className="italic hover:text-accent2">{r.album}</Link>
          {r.label && <span className="label-inline">{r.label}</span>}
          {r.flag && <span className="ml-2 rounded bg-warn/20 px-1.5 font-mono text-[10px] uppercase text-warn">{flagKey ? t.releases[flagKey] : r.flag}</span>}
          {r.dayLabel && <span className="ml-2 font-mono text-[11px] text-faint">{r.dayLabel}</span>}
        </h3>
        <p className="desc rich" dangerouslySetInnerHTML={{ __html: r.description }} />
        {r.reviews && (
          <p className="rev rich">
            <span className="k">{t.releases.reviews}</span>
            <span dangerouslySetInnerHTML={{ __html: r.reviews }} />
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
      <a href={links.spotify} target="_blank" rel="noopener" className={`${pill} border-spotify/40 text-spotify hover:bg-spotify/10`}>▶ Spotify</a>
      <a href={links.tidal} target="_blank" rel="noopener" className={`${pill} border-tidal/40 text-tidal hover:bg-tidal/10`}>▶ Tidal</a>
      <Link href={href} className={`${pill} border-rule text-muted hover:border-accent2 hover:text-accent2`}>{t.releases.travelCta}</Link>
    </div>
  );
}
