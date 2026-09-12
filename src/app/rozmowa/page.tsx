import type { Metadata } from "next";
import Link from "next/link";
import { Masthead } from "@/components/masthead";
import { heroArt, leadStyle } from "@/lib/lead-style";
import { currentUser } from "@/lib/auth";
import { getGenres } from "@/lib/user-data";
import { aiSkonfigurowane } from "@/lib/ai";
import { i18n } from "@/lib/t";
import { RozmowaForm } from "@/components/rozmowa-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await i18n();
  return { title: t.chat.title };
}
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PRZYKLADY = ["exPrime", "exSecond", "exThird"] as const;

/**
 * Początek rozmowy o muzyce.
 *
 * Czemu rozmowa, a nie od razu podróż: wynik modelu jest najpierw SZUKANIEM.
 * Da się go pooglądać, dopytać, pójść w bok — a podróż zrobić dopiero z tego,
 * co się uzbierało. Wcześniej z pierwszego zdania powstawała zamknięta lista
 * i jak nie trafiła, zostawało napisać wszystko od nowa.
 */
export default async function RozmowaStart() {
  const { t } = await i18n();
  const user = await currentUser();
  const lead = leadStyle(user ? await getGenres(user.id) : []);

  return (
    <>
      <Masthead art={heroArt(lead)} eyebrow={t.chat.eyebrow} title={t.chat.title} meta={<span>{t.chat.lead}</span>} />
      <div className="mx-auto mt-8 max-w-2xl space-y-6">
        {!user ? (
          <p className="text-muted"><Link href="/login" className="underline">{t.home.loginCta}</Link>{t.chat.loginRest}</p>
        ) : !aiSkonfigurowane() ? (
          /* Bez klucza ekran nie udaje, że działa — mówi, czego brakuje. */
          <div className="card">
            <p className="text-sm text-warn">{t.chat.noKey}</p>
            <p className="mt-2 font-mono text-xs text-faint">OPENROUTER_API_KEY albo ANTHROPIC_API_KEY</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted">{t.chat.empty}</p>
            <RozmowaForm t={t} />
            <div>
              <p className="label mb-2">{t.chat.examplesLabel}</p>
              <ul className="space-y-1 text-sm text-muted">
                {PRZYKLADY.map((k) => (
                  <li key={k} className="before:mr-2 before:text-faint before:content-['—']">
                    {(t.chat as unknown as Record<string, string>)[k]}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
        <p className="text-xs text-faint">{t.chat.honestNote}</p>
      </div>
    </>
  );
}
