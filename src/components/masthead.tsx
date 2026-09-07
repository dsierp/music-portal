/**
 * Nagłówek strony premier — duży, na całą szerokość, w klimacie tygodniowego
 * zestawienia „Pure New Shit".
 *
 * Tło i postać zależą od stylu wiodącego użytkownika (patrz lead-style.ts):
 * metalowiec dostaje demona PNS, jazzman saksofon, ktoś bez preferencji — pop.
 */
import type { HeroArt } from "@/lib/lead-style";

export function Masthead({
  art,
  eyebrow,
  title,
  meta,
  children,
}: {
  art: HeroArt;
  eyebrow: string;
  title: string;
  meta?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="masthead -mx-4 sm:-mx-6 lg:-mx-8">
      <div
        className="bg"
        aria-hidden
        style={art.pns ? undefined : { backgroundImage: `url(${art.bg})`, filter: "none", opacity: 0.55 }}
      />
      {art.ghoul && (
        /* Postacie gatunków są czarne na przezroczystym tle — klasa `figure`
           dokłada im poświatę, żeby nie zlały się z ciemnym nagłówkiem. */
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          className={art.ghoul.startsWith("/img/avatars/") ? `ghoul figure${art.pns ? " hot" : ""}` : "ghoul"}
          src={art.ghoul}
          alt=""
          aria-hidden
        />
      )}
      <div className="masthead-in">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          {art.pns ? (
            <h1>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="logo" src="/img/pns/logo.webp" alt={title} />
            </h1>
          ) : (
            <h1 className="text-5xl leading-none sm:text-6xl">{title}</h1>
          )}
          {meta && <div className="mt-5 font-mono text-xs text-text2">{meta}</div>}
          {children}
        </div>
      </div>
    </header>
  );
}

/** Nagłówek sekcji tygodnia — grafika gatunku, data serifem, licznik tytułów. */
export function SectionHead({ image, title, date, note, count, variant }: { image: string; title: string; date?: string | null; note?: string | null; count: number; variant: "red" | "morgue" | "other" }) {
  const cls = variant === "other" ? "friday-head" : `friday-head ${variant}`;
  return (
    <div className={cls} style={variant === "other" ? { backgroundImage: `url(${image})` } : undefined}>
      <h2 className="text-3xl leading-none">
        {title} {date && <em>{date}</em>}
      </h2>
      {note && <span className="text-sm text-text2">{note}</span>}
      <span className="cnt">{count} {count === 1 ? "tytuł" : "tytułów"}</span>
    </div>
  );
}
