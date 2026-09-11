import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Masthead } from "@/components/masthead";
import { heroArt, leadStyle } from "@/lib/lead-style";
import { currentUser } from "@/lib/auth";
import { getGenres } from "@/lib/user-data";
import { stanPodrozy } from "@/lib/podroz-zadanie";
import { i18n } from "@/lib/t";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await i18n();
  return { title: t.unknown.workingShort };
}
export const dynamic = "force-dynamic";
/**
 * Układanie podróży trwa około pół minuty (model + jedno zapytanie na sekundę
 * do MusicBrainz), a robota leci w `after()` TEJ SAMEJ funkcji — więc funkcja
 * musi mieć prawo tyle żyć. Domyślne dziesięć sekund ucinało ją w połowie.
 */
export const maxDuration = 60;

/**
 * Ekran czekania na podróż układaną w tle.
 *
 * Czemu osobny adres, a nie kręciołek w formularzu: formularz umierał razem
 * z żądaniem. Przełączenie karty albo kliknięcie gdzie indziej zabijało całą
 * robotę i nie zostawało po niej nic. Teraz podróż ma swój numer i swój adres:
 * można stąd wyjść, wrócić, odświeżyć, nawet przysłać sobie ten link na
 * telefon — zadanie leci swoim torem, a ten ekran tylko pokazuje, na czym stoi.
 *
 * Odświeżanie robi `<meta refresh>`, nie JavaScript. Brzydsze, ale działa
 * zawsze i nie ma czego popsuć.
 */
export default async function CzekaniePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t } = await i18n();
  const user = await currentUser();
  const stan = await stanPodrozy(id);

  if (stan?.stan === "gotowe") redirect(`/podroz/${stan.listId}`);

  const lead = leadStyle(user ? await getGenres(user.id) : []);
  const bledy = t.unknown.errors as Record<string, string>;
  const opis = stan?.opis ?? "";

  return (
    <>
      <Masthead art={heroArt(lead)} eyebrow={t.unknown.eyebrow} title={t.unknown.title} meta={<span>{t.unknown.lead}</span>} />
      <div className="mx-auto mt-8 max-w-2xl">
        {!stan ? (
          /* Notatka wygasa po dobie — a wtedy nie ma czego pokazywać. */
          <div className="card">
            <p className="text-sm text-muted">{t.unknown.gone}</p>
            <p className="mt-3">
              <Link href="/podroze/nieznane" className="btn btn-accent">{t.unknown.cta}</Link>
            </p>
          </div>
        ) : stan.stan === "blad" ? (
          <div className="space-y-4">
            <div className="rounded border border-warn bg-warn/10 p-4" role="alert">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0 text-lg leading-none text-warn" aria-hidden>!</span>
                <div className="min-w-0">
                  <p className="font-medium text-warn">{bledy[stan.blad] ?? bledy.nieznany}</p>
                  {stan.szczegol && <p className="mt-2 break-words font-mono text-xs text-faint">{stan.szczegol}</p>}
                </div>
              </div>
            </div>
            {/* Opis wraca w pole — nikt nie ma go przepisywać po nieudanej próbie. */}
            <Link href={`/podroze/nieznane?opis=${encodeURIComponent(opis)}`} className="btn btn-accent">
              {t.lists.tryAgain}
            </Link>
          </div>
        ) : (
          <>
            <meta httpEquiv="refresh" content="3" />
            <div className="rounded border border-rule bg-surface p-6" role="status" aria-live="polite">
              <div className="flex items-start gap-4">
                <span className="mt-1 h-6 w-6 shrink-0 animate-spin rounded-full border-2 border-rule border-t-accent" aria-hidden />
                <div className="min-w-0 space-y-2">
                  <p className="label">{t.unknown.youAsked}</p>
                  <p className="text-lg text-text">&bdquo;{opis}&rdquo;</p>
                  <p className="text-sm text-text2">{t.unknown.working}</p>
                </div>
              </div>
              <p className="mt-5 text-xs text-faint">{t.unknown.leaveOk}</p>
            </div>
          </>
        )}
      </div>
    </>
  );
}
