import type { Metadata } from "next";
import Link from "next/link";
import { Banner } from "@/components/banner";
import { AlbumCard } from "@/components/cards";

import { currentUser } from "@/lib/auth";
import { wczytajRozmowe, plytyZRozmowy, utknela } from "@/lib/rozmowa";
import { i18n } from "@/lib/t";
import { fmt } from "@/lib/i18n";
import { RozmowaForm } from "@/components/rozmowa-form";
import { Odswiezaj } from "@/components/odswiezanie";
import { Pytanie } from "@/components/rozmowa-pytanie";
import { kawalkiZRozmowy, podrozZRozmowy, domknijRozmowe } from "@/app/actions";

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
  const bledy = t.chat.errors as Record<string, string>;
  const mojaRozmowa = !!r && !!user && r.userId === user.id;
  const plyty = r ? plytyZRozmowy(r) : [];
  /**
   * Tura bez śladu życia od dwóch minut już nie wróci — Vercel ucina funkcję
   * po minucie i nikt wtedy nie przestawia stanu. Bez tego ekran kręcił się
   * w nieskończoność; dwie godziny, zanim ktoś dał znać.
   */
  const utkniete = !!r && utknela(r);
  const czekamy = !!r && r.stan === "robi" && !utkniete;
  const czesciowe = r?.czesciowe ?? [];

  return (
    <>
      {/* Sztorm, nie nagłówek jak wszędzie indziej: to jedyne miejsce
          w portalu, gdzie wypływa się bez mapy. */}
      <Banner image="/img/statek.jpg" title={t.chat.title} position="center 45%">
        <p className="mt-3 max-w-2xl text-text2">{t.chat.lead}</p>
      </Banner>
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
            {/* Cała rozmowa siedzi w JEDNYM formularzu wyboru: ptaszki przy
                płytach i dwa przyciski na dole działają na tym samym zbiorze.
                Pole nowej wiadomości jest osobnym formularzem — formularzy nie
                wolno zagnieżdżać. */}
            <form id="wybor" className="space-y-6">
            <input type="hidden" name="id" value={r.id} />
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
                            <div key={p.album.mbid} className="flex items-start gap-2">
                              {/* Ptaszek, bo zbioru inaczej nie da się poprawić.
                                  „Wymień mi X na Y" dokładało Y, ale X zostawało
                                  i lądowało w podróży razem z nim. Domyślnie
                                  wszystko zaznaczone — kto nie chce nic
                                  odklikiwać, nie zauważy różnicy. */}
                              <label className="mt-3 flex shrink-0 cursor-pointer items-center gap-1" title={t.chat.keepIt}>
                                <input type="checkbox" name="wybrane" value={p.album.mbid} defaultChecked className="accent-accent" />
                              </label>
                              <div className="min-w-0 flex-1">
                                <AlbumCard
                                  album={p.album}
                                  extra={p.why ? <div className="text-xs text-muted">{p.why}</div> : undefined}
                                />
                              </div>
                            </div>
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

            {/* Płyty potwierdzone w TRWAJĄCEJ turze — pokazujemy je od razu,
                bo są już prawdziwe. Dzięki temu „daj co masz" nie jest obietnicą,
                tylko tym, co człowiek ma przed oczami. */}
            {r.stan === "robi" && czesciowe.length > 0 && (
              <div className="space-y-2">
                <p className="label">{t.chat.found} <span className="font-mono text-faint">{czesciowe.length}</span></p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {czesciowe.map((p) => (
                    <AlbumCard
                      key={p.album.mbid}
                      album={p.album}
                      extra={p.why ? <div className="text-xs text-muted">{p.why}</div> : undefined}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Szukanie urwane w pół kroku. Nie udajemy, że trwa. */}
            {utkniete && (
              <div className="rounded border border-warn bg-warn/10 p-4" role="alert">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 shrink-0 text-lg leading-none text-warn" aria-hidden>!</span>
                  <div className="min-w-0 space-y-3">
                    <p className="font-medium text-warn">{bledy.urwane}</p>
                    <button formAction={domknijRozmowe} className="btn">
                      {czesciowe.length ? t.chat.takeWhatIsThere : t.chat.giveUp}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {czekamy && (
              <>
                <Odswiezaj />
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
                  {/* Czekanie ma mieć wyjście. Płyty na górze są już
                      potwierdzone — kto ma dość, bierze tyle, ile jest. */}
                  {czesciowe.length > 0 && (
                    <p className="mt-3">
                      <button formAction={domknijRozmowe} className="btn">
                        {t.chat.takeWhatIsThere}
                      </button>
                    </p>
                  )}
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

            {/* Dopiero TU z szukania robi się lista — gdy człowiek uzna, że warto,
                i z tego, co sam zostawił zaznaczone. */}
            {plyty.length > 0 && r.stan !== "robi" && (
              <div className="space-y-4 border-t border-rule pt-6">
                <div className="flex flex-wrap gap-3">
                  <button formAction={podrozZRozmowy} className="btn">
                    {t.chat.makeJourney}
                  </button>
                  <button formAction={kawalkiZRozmowy} className="btn btn-accent">
                    {t.chat.pickStops}
                  </button>
                </div>
                <p className="text-xs text-faint">{t.chat.makeJourneyNote}</p>
                <p className="text-xs text-faint">{t.chat.pickStopsNote}</p>
              </div>
            )}
            </form>

            {r.stan !== "robi" && <RozmowaForm t={t} id={r.id} />}
          </>
        )}
      </div>
    </>
  );
}
