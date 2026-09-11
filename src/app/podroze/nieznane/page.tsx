import type { Metadata } from "next";
import Link from "next/link";
import { Masthead } from "@/components/masthead";
import { heroArt, leadStyle } from "@/lib/lead-style";
import { currentUser } from "@/lib/auth";
import { getGenres } from "@/lib/user-data";
import { aiSkonfigurowane } from "@/lib/ai";
import { i18n } from "@/lib/t";
import { FormularzNieznane } from "@/components/nieznane-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await i18n();
  return { title: t.unknown.title };
}
export const dynamic = "force-dynamic";

/**
 * Ekran „podróży w nieznane".
 *
 * Odwrotność reszty portalu: tam wiesz, dokąd jedziesz, i klikasz się przez
 * składy. Tu piszesz, czego chcesz posłuchać, i dostajesz listę płyt do
 * sprawdzenia. Model proponuje, MusicBrainz potwierdza — patrz podroz-nieznane.ts.
 */
export default async function NieznanePage() {
  const { t } = await i18n();
  const user = await currentUser();
  const lead = leadStyle(user ? await getGenres(user.id) : []);

  return (
    <>
      <Masthead art={heroArt(lead)} eyebrow={t.unknown.eyebrow} title={t.unknown.title} meta={<span>{t.unknown.lead}</span>} />
      <div className="mx-auto mt-8 max-w-2xl">
        {!user ? (
          <p className="text-muted"><Link href="/login" className="underline">{t.home.loginCta}</Link>{t.unknown.loginRest}</p>
        ) : !aiSkonfigurowane() ? (
          /* Bez klucza ekran nie udaje, że działa — mówi, czego brakuje. */
          <div className="card">
            <p className="text-sm text-warn">{t.unknown.noKey}</p>
            <p className="mt-2 font-mono text-xs text-faint">OPENROUTER_API_KEY albo ANTHROPIC_API_KEY</p>
          </div>
        ) : (
          <FormularzNieznane t={t} />
        )}
      </div>
    </>
  );
}
