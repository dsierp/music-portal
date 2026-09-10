import Link from "next/link";
import type { Metadata } from "next";
import { i18n } from "@/lib/t";
import type { HelpScreen } from "@/lib/dict/help";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await i18n();
  return { title: t.help.guideTitle, description: t.help.guideLead };
}

/** Kolejność ekranów odpowiada drodze, którą przechodzi nowy użytkownik. */
const EKRANY = ["start", "szukaj", "premiery", "artysta", "plyta", "koncerty", "podroze"] as const;

/**
 * Cały przewodnik na jednej stronie — to samo, co w panelach na ekranach.
 *
 * Jedno źródło treści: panel przy ekranie i ta strona czytają ten sam słownik,
 * więc nie da się poprawić jednego i zapomnieć o drugim.
 */
export default async function Pomoc() {
  const { t } = await i18n();
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 className="display text-4xl">{t.help.guideTitle}</h1>
        <p className="mt-3 text-lg text-text2">{t.help.guideLead}</p>
      </header>
      <div className="space-y-8">
        {EKRANY.map((k) => {
          const e = t.help[k] as unknown as HelpScreen;
          return (
            <section key={k}>
              <h2 className="text-2xl">{e.title}</h2>
              <p className="mt-1 text-sm text-muted">{e.lead}</p>
              <ol className="mt-3 space-y-2">
                {e.steps.map((s, i) => (
                  <li key={s.h} className="flex gap-3 text-sm">
                    <span className="mt-0.5 shrink-0 font-mono text-xs text-faint">{i + 1}</span>
                    <span>
                      <span className="font-medium">{s.h}</span>
                      <span className="text-text2"> — {s.p}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          );
        })}
      </div>
      <Link href="/o-portalu" className="inline-block text-sm text-muted hover:text-accent2">
        {t.about.title} →
      </Link>
    </div>
  );
}
