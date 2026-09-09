import Link from "next/link";
import type { Metadata } from "next";
import { i18n } from "@/lib/t";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await i18n();
  return { title: t.about.title, description: t.about.lead };
}

/**
 * „Co to za portal" — jeden ekran, cztery akapity.
 *
 * Sekcja o dziurach w danych nie jest tu z pokory, tylko z praktyki: portal
 * świadomie pokazuje „?" i przerywane paski zamiast chować niepewne dane,
 * a bez uprzedzenia wygląda to jak usterka.
 */
export default async function OPortalu() {
  const { t } = await i18n();
  const sekcje = [
    { h: t.about.whatTitle, p: t.about.whatBody },
    { h: t.about.dataTitle, p: t.about.dataBody },
    { h: t.about.gapsTitle, p: t.about.gapsBody },
    { h: t.about.privacyTitle, p: t.about.privacyBody },
  ];
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 className="display text-4xl">{t.about.title}</h1>
        <p className="mt-3 text-lg text-text2">{t.about.lead}</p>
      </header>
      <div className="space-y-6">
        {sekcje.map((s) => (
          <section key={s.h}>
            <h2 className="text-2xl">{s.h}</h2>
            <p className="mt-2 text-sm leading-relaxed text-text2">{s.p}</p>
          </section>
        ))}
      </div>
      <Link href="/" className="inline-block text-sm text-muted hover:text-accent2">
        ← {t.about.backHome}
      </Link>
    </div>
  );
}
