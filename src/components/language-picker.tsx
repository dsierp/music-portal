"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { setLocaleAction } from "@/app/actions";
import { LOCALES, LOCALE_NAMES, type Locale } from "@/lib/i18n";

/**
 * Wybór języka — zwykły formularz z server action, bez własnego javascriptu
 * poza odczytem adresu.
 *
 * Flagi odpadają (język to nie kraj: hiszpański ma kilkanaście ojczyzn), więc
 * podpisujemy kodem, a pełna nazwa siedzi w dymku. Po zmianie wracamy dokładnie
 * tam, gdzie człowiek był — adresy są wspólne dla wszystkich języków, więc nie
 * ma dokąd przekierowywać.
 */
export function LanguagePicker({ locale, label }: { locale: Locale; label: string }) {
  const path = usePathname();
  const params = useSearchParams().toString();
  const back = params ? `${path}?${params}` : path;
  return (
    <form action={setLocaleAction} className="flex items-center gap-0.5" aria-label={label}>
      <input type="hidden" name="back" value={back} />
      {LOCALES.map((l) => (
        <button
          key={l}
          name="locale"
          value={l}
          title={LOCALE_NAMES[l]}
          aria-current={l === locale ? "true" : undefined}
          className={`rounded px-1.5 py-0.5 font-mono text-[11px] uppercase transition-colors ${
            l === locale ? "bg-surface2 text-accent2" : "text-faint hover:text-text2"
          }`}
        >
          {l}
        </button>
      ))}
    </form>
  );
}
