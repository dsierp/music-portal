import Link from "next/link";
import { i18n } from "@/lib/t";
import type { HelpScreen } from "@/lib/dict/help";

/**
 * Przewodnik po ekranie, zwinięty do jednego wiersza.
 *
 * Zwinięty, bo instrukcja na stałe rozwinięta odbiera miejsce tym, którzy już
 * wiedzą — a rozwija się bez JavaScriptu (`details`), więc działa od pierwszej
 * milisekundy i nie czeka na nic.
 *
 * `screen` wskazuje sekcję w słowniku, żeby ekran nie musiał znać treści —
 * dzięki temu przewodnik dopisuje się jedną linijką w dowolnym miejscu.
 */
export async function ScreenHelp({ screen }: { screen: keyof typeof import("@/lib/dict/help").help.pl }) {
  const { t } = await i18n();
  const dane = t.help[screen] as unknown as HelpScreen;
  if (!dane || typeof dane === "string") return null;
  return (
    <details className="mb-6 rounded-lg border border-rule bg-surface2/60 px-3 py-2">
      <summary className="cursor-pointer text-sm text-muted hover:text-accent2">{t.help.open}</summary>
      <div className="mt-3">
        <h2 className="text-lg">{dane.title}</h2>
        <p className="mt-1 text-sm text-text2">{dane.lead}</p>
        <ol className="mt-3 space-y-2">
          {dane.steps.map((s, i) => (
            <li key={s.h} className="flex gap-3 text-sm">
              <span className="mt-0.5 shrink-0 font-mono text-xs text-faint">{i + 1}</span>
              <span>
                <span className="font-medium">{s.h}</span>
                <span className="text-text2"> — {s.p}</span>
              </span>
            </li>
          ))}
        </ol>
        <Link href="/pomoc" className="mt-3 inline-block text-xs text-muted hover:text-accent2">
          {t.help.fullGuide}
        </Link>
      </div>
    </details>
  );
}
