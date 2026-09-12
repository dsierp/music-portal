import type { Metadata } from "next";
import Link from "next/link";
import { Masthead } from "@/components/masthead";
import { AlbumCard } from "@/components/cards";
import { heroArt, leadStyle } from "@/lib/lead-style";
import { currentUser } from "@/lib/auth";
import { getGenres } from "@/lib/user-data";
import { wczytajRozmowe, plytyZRozmowy } from "@/lib/rozmowa";
import { i18n } from "@/lib/t";
import { fmt } from "@/lib/i18n";
import { RozmowaForm } from "@/components/rozmowa-form";
import { Pytanie } from "@/components/rozmowa-pytanie";
import { podrozZRozmowy } from "@/app/actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await i18n();
  return { title: t.chat.title };
}
export const dynamic = "force-dynamic";
/**
 * Tura trwa kilkanaście–kilkadziesiąt sekund, a robota leci w `after()` TEJ
 * SAMEJ funkcji — więc funkcja musi mieć prawo tyle żyć. Domyślne dziesięć
 * sekund ucinało ją w połowie.
 */
export const maxDuration = 60;

/**
 * Rozmowa o muzyce: pytania, odpowiedzi i płyty jako WYNIKI SZUKANIA.
 *
 * Każda płyta przeszła przez MusicBrainz, więc w każdą da się wejść i dalej
 * podróżować po składzie. Podróż (czyli zapisana lista) powstaje dopiero
 * z przycisku na dole — z całej rozmowy, nie z pierwszej lepszej odpowiedzi.
 *
 * Gdy tura leci, ekran odświeża się sam przez `<meta refresh>`. Brzydsze niż
 * JavaScript, ale działa zawsze i nie ma czego popsuć.
 */
export default async function RozmowaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t } = await i18n();
  const user = await currentUser();
  const r = await wczytajRozmowe(id);
  const lead = leadStyle(user ? await getGenres(user.id) : []);
  const bledy = t.chat.errors as Record<string, string>;
  const mojaRozmowa = !!r && !!user && r.userId === user.id;
  const plyty = r ? plytyZRozmowy(r) : [];

  return (
    <>
      <Masthead art={heroArt(lead)} eyebrow={t.chat.eyebrow} title={t.chat.title} meta={<span>{t.chat.lead}</span>} />
      <div className="mx-auto mt-8 max-w-3xl space-y-6">
        <p>
          <Link href="/rozmowa" className="text-sm text-muted hover:text-accent2">{t.chat.newChat}</Link>
        </p>

        {!r || !mojaRozmowa ? (
          <div className="card">
            <p className="text-sm text-muted">{t.chat.gone}</p>
            <p className="mt-3"><Link href="/rozmowa" className="btn btn-accent">{t.chat.newChat}</Link></p>
          </div>
        ) : (
          <>
            {r.wiadomosci.map((w, i) => (
              <div key={i} className={w.rola === "ja" ? "" : "space-y-4"}>
                {w.rola === "ja" ? (
                  <Pytanie t={t} tekst={w.tekst} id={r.id} />
                ) : (
                  <>
                    {w.tekst && <p className="text-text2">{w.tekst}</p>}
                    {!!w.plyty?.length && (
                      <>
                        <p className="label">{t.chat.found} <span className="font-mono text-faint">{w.plyty.length}</span></p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {w.plyty.map((p) => (
                            <AlbumCard
                              key={p.album.mbid}
                              album={p.album}
                              extra={p.why ? <div className="text-xs text-muted">{p.why}</div> : undefined}
                            />
                          ))}
                        </div>
                      </>
                    )}
                    {/* Mówimy, ile odpadło. Inaczej „poprosiłem o osiem, dostałem
                        trzy" wygląda na to, że model się nie postarał. */}
                    {!!w.odpadlo && <p className="text-xs text-faint">{fmt(t.chat.dropped, { n: w.odpadlo })}</p>}
                  </>
                )}
              </div>
            ))}

            {r.stan === "robi" && (
              <>
                <meta httpEquiv="refresh" content="3" />
                <div className="rounded border border-rule bg-surface p-6" role="status" aria-live="polite">
                  <div className="flex items-center gap-4">
                    <span className="h-6 w-6 shrink-0 animate-spin rounded-full border-2 border-rule border-t-accent" aria-hidden />
                    <p className="text-sm text-text2">{t.chat.working}</p>
                  </div>
                  {/* Co się właśnie dzieje, wiersz po wierszu. Kręciołek mówi
                      „coś się dzieje"; to mówi CO — którą płytę sprawdzam
                      i która przed chwilą odpadła. Przy czymś, co trwa pół
                      minuty, to jest różnica między czekaniem a gapieniem się. */}
                  {!!r.postep?.length && (
                    <ul className="mt-4 space-y-1 font-mono text-xs">
                      {r.postep.map((linia, j) => {
                        const [rodzaj, co] = linia.split("::");
                        const podpis =
                          rodzaj === "szukam" ? t.chat.stepSearching
                          : rodzaj === "sprawdzam" ? t.chat.stepChecking
                          : rodzaj === "mam" ? t.chat.stepHave
                          : t.chat.stepMissing;
                        return (
                          <li key={j} className={rodzaj === "brak" ? "text-faint line-through" : "text-muted"}>
                            <span className={rodzaj === "mam" ? "text-accent2" : "text-faint"}>
                              {rodzaj === "mam" ? "✓" : rodzaj === "brak" ? "✕" : "·"}
                            </span>{" "}
                            {podpis}{co ? `: ${co}` : ""}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <p className="mt-4 text-xs text-faint">{t.chat.leaveOk}</p>
                </div>
              </>
            )}

            {r.stan === "blad" && (
              <div className="rounded border border-warn bg-warn/10 p-4" role="alert">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 shrink-0 text-lg leading-none text-warn" aria-hidden>!</span>
                  <div className="min-w-0">
                    <p className="font-medium text-warn">{bledy[r.blad ?? "nieznany"] ?? bledy.nieznany}</p>
                    
                  </div>
                </div>
              </div>
            )}

            {r.stan !== "robi" && <RozmowaForm t={t} id={r.id} />}

            {/* Dopiero TU z szukania robi się lista — gdy człowiek uzna, że warto. */}
            {plyty.length > 0 && r.stan !== "robi" && (
              <form action={podrozZRozmowy} className="border-t border-rule pt-6">
                <input type="hidden" name="id" value={r.id} />
                <button className="btn">{t.chat.makeJourney} <span className="ml-2 font-mono text-xs text-faint">{plyty.length}</span></button>
                <p className="mt-2 text-xs text-faint">{t.chat.makeJourneyNote}</p>
              </form>
            )}
          </>
        )}
      </div>
    </>
  );
}
