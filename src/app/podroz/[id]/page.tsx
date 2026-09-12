import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { currentUser } from "@/lib/auth";
import { canSeeList, getList, otherUsers, sharedWith, visitedStops } from "@/lib/user-data";
import { spotifyConfigured, spotifyConnected } from "@/lib/spotify";
import { connectSpotify, deleteListAction, kawalkiZListy, removeFromListAction, sendJourneyToSpotify, shareListAction, toggleVisitAction } from "@/app/actions";
import { Cover } from "@/components/cover";
import { i18n } from "@/lib/t";
import { fmt, formatDate, plural } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const data = await getList((await params).id).catch(() => null);
  return { title: data?.list.title ?? "" };
}

/**
 * Jedna lista: pozycje w kolejności, w jakiej ułożył je autor, i — dla autora —
 * polecenie jej konkretnym osobom.
 *
 * Lista jest prywatna: widzi ją autor i ci, którym ją polecił. Bez publicznych
 * adresów „na skróty" — polecenie ma być gestem wobec kogoś, a nie publikacją.
 */
export default async function ListPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ spotify?: string; n?: string; pominieto?: string; url?: string; usun?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { locale, t } = await i18n();
  const user = await currentUser();
  const data = await getList(id).catch(() => null);
  if (!data) notFound();
  const moja = user?.id === data.list.userId;
  const usuwanie = sp.usun === "1";
  if (!(await canSeeList(user?.id ?? null, id, data.list.userId))) notFound();

  const [ludzie, wyslane] = moja
    ? await Promise.all([otherUsers(user!.id), sharedWith(id)])
    : [[] as { id: string; name: string; me: boolean }[], [] as { userId: string; dismissedAt: Date | null }[]];
  const juzPolecone = new Set(wyslane.map((w) => w.userId));
  // Odhaczone przystanki są PRYWATNE dla oglądającego: ta sama podróż u dwóch
  // osób ma osobne ptaszki, bo „znam to" jest cechą człowieka, nie listy.
  const poznane = user ? await visitedStops(user.id, id).catch(() => new Map<string, string>()) : new Map<string, string>();
  const spotifyGotowy = spotifyConfigured();
  const spotifyPolaczony = moja && spotifyGotowy && user ? await spotifyConnected(user.id).catch(() => false) : false;
  // Adresów płyt w Spotify NIE rozwiązujemy tutaj. Robiliśmy tak — wszystkie
  // naraz, przez Promise.all — i Spotify odpowiadał 429 („QUOTA_EXCEEDED"),
  // przez co nie trafiał żaden link. Teraz robi to trasa /go/stop w chwili
  // kliknięcia: jedno wyjście = jedno zapytanie.

  return (
    <div className="space-y-6">
      <header>
        {/* Wyjscie z podrozy. Dotad to byl slepy zaulek: lista sie ulozyla,
            a stad nie bylo ani drogi powrotnej, ani sposobu, zeby powiedziec
            „to nie to". Teraz opis wraca do pola i poprawia sie jedno zdanie. */}
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link href="/podroze" className="text-muted hover:text-accent2">← {t.nav.lists}</Link>
          {moja && data.list.description && (
            <Link href={`/rozmowa?opis=${encodeURIComponent(data.list.description)}`} className="text-accent2 hover:text-accent">
              {t.lists.tryAgain}
            </Link>
          )}
        </div>
        <div className="label">{moja ? t.lists.myListsTitle : t.lists.listBy}</div>
        <h1 className="text-4xl">{data.list.title}</h1>
        {data.list.description && <p className="mt-2 max-w-2xl text-text2">{data.list.description}</p>}
        <p className="mt-1 font-mono text-xs text-muted">
          {plural(locale, data.items.length, t.lists.itemsCount)} · {formatDate(data.list.updatedAt.toISOString().slice(0, 10), locale, { year: true })}
          {user && data.items.length > 0 && ` · ${fmt(t.lists.visitedCount, { done: poznane.size, all: data.items.length })}`}
        </p>
        {user && data.items.length > 0 && <p className="mt-1 text-[10px] text-faint">{t.lists.visitedNote}</p>}
      </header>

      {data.items.length ? (
        <ol className="space-y-2">
          {data.items.map((it, i) => (
            <li key={`${it.targetType}-${it.targetMbid}`} className="flex items-center gap-3 rounded-lg border border-rule bg-surface p-2">
              <span className="w-6 shrink-0 text-center font-mono text-sm text-faint">{i + 1}</span>
              {it.targetType === "ALBUM" ? <Cover mbid={it.targetMbid} size={44} /> : null}
              <div className="min-w-0 flex-1">
                {/* Koncert nie ma u nas strony — prowadzimy na afisz, do którego
                    i tak trzeba pójść po bilet. */}
                {it.targetType === "CONCERT" ? (
                  it.url ? (
                    <a href={it.url} target="_blank" rel="noopener" className="block truncate font-medium hover:text-accent2 hover:underline">
                      {it.label}
                    </a>
                  ) : (
                    <span className="block truncate font-medium">{it.label}</span>
                  )
                ) : it.targetType === "RECORDING" ? (
                  /* Utwór świadomie nie ma u nas strony — portal jest o płytach.
                     Zostaje nazwa i wyjścia do serwisów, bo po to tu jest. */
                  <span className="block truncate font-medium">{it.label}</span>
                ) : (
                  <Link
                    href={it.targetType === "ALBUM" ? `/album/${it.targetMbid}` : `/artist/${it.targetMbid}`}
                    className="block truncate font-medium hover:text-accent2 hover:underline"
                  >
                    {it.label}
                  </Link>
                )}
                <span className="font-mono text-[10px] uppercase text-faint">
                  {it.targetType === "ALBUM"
                    ? t.common.album
                    : it.targetType === "ARTIST"
                      ? t.common.band
                      : it.targetType === "RECORDING"
                        ? t.lists.trackLabel
                        : t.nav.concerts}
                </span>
                {it.note && <p className="text-xs text-muted">{it.note}</p>}
                {/* Wyjścia do serwisów prowadzą przez naszą trasę, która po
                    drodze stawia ptaszek — „znam to" bierze się z tego, co
                    człowiek i tak robi, a nie z pamiętania o odhaczeniu. */}
                {it.targetType !== "CONCERT" && (
                  <div className="mt-0.5 flex gap-3">
                    {[
                      // Spotify: adres dobiera trasa /go/stop przy kliknięciu —
                      // prosto na płytę, a gdy jej nie znajdzie, wyszukiwarka.
                      {
                        nazwa: "Spotify",
                        param:
                          it.targetType === "ALBUM" && spotifyGotowy
                            ? `&serwis=spotify&etykieta=${encodeURIComponent(it.label)}`
                            : `&to=${encodeURIComponent(`https://open.spotify.com/search/${encodeURIComponent(it.label.replace(/\s+[–—-]\s+/, " "))}`)}`,
                      },
                      {
                        nazwa: "Tidal",
                        param: `&to=${encodeURIComponent(`https://tidal.com/search?q=${encodeURIComponent(it.label.replace(/\s+[–—-]\s+/, " "))}`)}`,
                      },
                    ].map((s) => (
                      <a
                        key={s.nazwa}
                        href={`/go/stop?listId=${encodeURIComponent(id)}&type=${it.targetType}&mbid=${encodeURIComponent(it.targetMbid)}${s.param}`}
                        target="_blank"
                        rel="noopener"
                        title={fmt(t.lists.openIn, { name: s.nazwa })}
                        className="font-mono text-[10px] text-muted hover:text-accent2"
                      >
                        ▸ {s.nazwa}
                      </a>
                    ))}
                  </div>
                )}
              </div>
              {user && (
                <form action={toggleVisitAction} className="shrink-0">
                  <input type="hidden" name="listId" value={id} />
                  <input type="hidden" name="type" value={it.targetType} />
                  <input type="hidden" name="mbid" value={it.targetMbid} />
                  <input type="hidden" name="current" value={poznane.has(`${it.targetType}:${it.targetMbid}`) ? "1" : "0"} />
                  <button
                    title={poznane.has(`${it.targetType}:${it.targetMbid}`) ? t.lists.unmarkVisited : t.lists.markVisited}
                    className={`font-mono text-sm ${poznane.has(`${it.targetType}:${it.targetMbid}`) ? "text-ok" : "text-faint hover:text-accent2"}`}
                  >
                    ✓
                  </button>
                </form>
              )}
              {moja && (
                <form action={removeFromListAction}>
                  <input type="hidden" name="listId" value={id} />
                  <input type="hidden" name="type" value={it.targetType} />
                  <input type="hidden" name="mbid" value={it.targetMbid} />
                  <button className="text-xs text-muted hover:text-accent2">{t.lists.removeItem}</button>
                </form>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted">{t.lists.emptyMyList}</p>
      )}

      {moja && spotifyGotowy && (
        <section className="card">
          <h2 className="text-xl">{t.lists.toSpotify}</h2>
          <p className="mt-1 text-xs text-muted">{t.lists.toSpotifyNote}</p>
          {sp.spotify === "ok" && (
            <p className="mt-2 text-sm text-ok">
              {fmt(t.lists.spotifyOk, { n: sp.n ?? "0" })}{" "}
              {Number(sp.pominieto) > 0 && <span className="text-muted">{fmt(t.lists.spotifySkipped, { n: sp.pominieto ?? "0" })}</span>}{" "}
              {sp.url && <a href={sp.url} target="_blank" rel="noopener" className="underline">{t.lists.spotifyOpen}</a>}
            </p>
          )}
          {sp.spotify === "pusto" && <p className="mt-2 text-sm text-warn">{t.lists.spotifyEmpty}</p>}
          {sp.spotify === "blad" && <p className="mt-2 text-sm text-warn">{t.lists.spotifyError}</p>}
          <form action={spotifyPolaczony ? sendJourneyToSpotify : connectSpotify.bind(null, `/podroz/${id}`)} className="mt-3">
            <input type="hidden" name="listId" value={id} />
            <button className="btn btn-accent">{spotifyPolaczony ? t.lists.toSpotify : t.lists.spotifyConnect}</button>
          </form>
        </section>
      )}

      {moja && (
        <section className="card">
          <h2 className="text-xl">{t.lists.shareTitle}</h2>
          {ludzie.length ? (
            <form action={shareListAction} className="mt-2 space-y-2">
              <input type="hidden" name="listId" value={id} />
              <div className="flex flex-wrap gap-3">
                {ludzie.map((p) => (
                  <label key={p.id} className="flex items-center gap-1.5 text-sm">
                    <input type="checkbox" name="to" value={p.id} defaultChecked={juzPolecone.has(p.id)} />
                    {p.me ? t.lists.meLabel : p.name}
                  </label>
                ))}
              </div>
              <input name="note" placeholder={t.lists.shareNote} className="input py-1 text-sm" autoComplete="off" />
              <button className="btn btn-accent">{t.lists.shareSubmit}</button>
              {juzPolecone.size > 0 && (
                <p className="font-mono text-[10px] text-faint">
                  {fmt(t.lists.sharedAlready, {
                    names: ludzie.filter((p) => juzPolecone.has(p.id)).map((p) => p.name).join(", "),
                  })}
                </p>
              )}
            </form>
          ) : (
            <p className="mt-2 text-sm text-muted">{t.lists.shareNoUsers}</p>
          )}
        </section>
      )}

      {/* Z płyt na kawałki. Osobna lista, nie przeróbka tej — podróż po płytach
          i wieczór po dwa kawałki to dwie różne rzeczy i obie mają prawo istnieć. */}
      {moja && data.items.some((i) => i.targetType === "ALBUM") && (
        <form action={kawalkiZListy} className="border-t border-rule pt-6">
          <input type="hidden" name="listId" value={id} />
          <button className="btn">{t.lists.pickStops}</button>
          <p className="mt-2 text-xs text-faint">{t.lists.pickStopsNote}</p>
        </form>
      )}

      {/* Kasowanie w dwóch krokach. Był tu jeden przycisk, który usuwał podróż
          od razu — przy czymś nieodwracalnym to za mało. Pytanie idzie przez
          adres, więc działa bez JavaScriptu i bez okienka. */}
      {moja && (
        usuwanie ? (
          <div className="rounded border border-warn bg-warn/10 p-3">
            <p className="text-sm text-warn">{fmt(t.lists.deleteConfirm, { title: data.list.title })}</p>
            <div className="mt-2 flex items-baseline gap-4">
              <form action={deleteListAction}>
                <input type="hidden" name="listId" value={id} />
                <button className="text-sm font-medium text-warn hover:underline">{t.lists.deleteYes}</button>
              </form>
              <Link href={`/podroz/${id}`} className="text-sm text-muted hover:text-accent2">{t.common.cancel}</Link>
            </div>
          </div>
        ) : (
          <Link href={`/podroz/${id}?usun=1`} className="text-xs text-muted hover:text-warn">{t.lists.deleteList}</Link>
        )
      )}
    </div>
  );
}
