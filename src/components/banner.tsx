/**
 * Nagłówek z fotografią w tle. Zdjęcia są ciemne i mocno przygaszone gradientem,
 * żeby tekst pozostał czytelny, a strona nie zrobiła się „stockowa" — obraz ma
 * budować nastrój, nie krzyczeć.
 */
export function Banner({
  image,
  title,
  subtitle,
  position = "center",
  compact = false,
  children,
}: {
  image: string;
  title: string;
  subtitle?: string;
  /** wycinek zdjęcia (object-position) — dla kadrów, gdzie ważny motyw nie jest na środku */
  position?: string;
  /** niższy pasek — do stron, gdzie nagłówek dzieli miejsce z kolumną boczną */
  compact?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-xl border border-rule">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover opacity-40"
        style={{ objectPosition: position }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/85 to-bg/30" />
      <div className={`relative ${compact ? "p-5 sm:p-6" : "p-6 sm:p-10"}`}>
        <h1 className={`${compact ? "text-4xl" : "text-5xl"} leading-none`}>{title}</h1>
        {subtitle && <p className="mt-3 max-w-2xl text-text2">{subtitle}</p>}
        {children}
      </div>
    </section>
  );
}
