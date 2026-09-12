import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import type { Metadata } from "next";
import { currentUser } from "@/lib/auth";
import { canSeeList, findUsersByNick, getList, otherUsers, sharedWith, visitedStops } from "@/lib/user-data";
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
  searchParams: Promise<{ spotify?: string; n?: string; pominieto?: string; url?: string; usun?: string; kto?: string }>;
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

  /**
   * Czego NIE ma w serwisach — z poprzednich kliknięć.
   *
   * Jedno zapytanie na całą podróż (nie jedno na wiersz), bo to tylko podpowiedź
   * graficzna. Pierwsze wyjście jest w ciemno; potem każdy widzi, że tam czeka
   * wyszukiwarka, a nie płyta.
   */
  const { kvGetMany, kvSet } = await import("@/lib/cache");
  const doSprawdzenia = data.items
    .filter((i) => i.targetType === "ALBUM" || i.targetType === "RECORDING")
    .slice(0, 12);
  const klucze = doSprawdzenia.flatMap((i) => [`link:spotify:${i.targetMbid}`, `link:tidal:${i.targetMbid}`]);
  const znane = await kvGetMany<{ url: string | null }>(klucze);
  /** `true` = mamy adres, `false` = wiemy, że go nie ma, `undefined` = nie sprawdzone. */
  const stanLinku = new Map<string, boolean>(
    [...znane.entries()].map(([k, v]) => [k.replace(/^link:/, ""), !!v?.url]),
  );

  /**
   * Czego jeszcze nie wiemy — dociągamy PO ODDANIU STRONY.
   *
   * Inaczej nie dałoby się tego pokazać uczciwie: żeby wiedzieć, czy przystanek
   * ma adres w serwisie, trzeba zapytać MusicBrainz, a to sekunda na zapytanie.
   * Wpleceni w render kazalibyśmy człowiekowi czekać pół minuty na listę, którą
   * już widzi. Więc pierwsze wejście pokazuje „nie sprawdzone", a robota leci
   * w tle i przy następnym odświeżeniu stan jest już prawdziwy.
   */
  const brakujace = klucze.filter((k) => !znane.has(k));
  if (brakujace.length) {
    after(async () => {
      const { linkSerwisu, HOST_SPOTIFY, HOST_TIDAL } = await import("@/lib/musicbrainz");
      for (const k of brakujace.slice(0, 24)) {
        const [, serwis, mb] = k.split(":");
        const poz = doSprawdzenia.find((i) => i.targetMbid === mb);
        if (!poz) continue;
        const url = await linkSerwisu(
          poz.targetType === "RECORDING" ? "recording" : "release-group",
          mb,
          serwis === "tidal" ? HOST_TIDAL : HOST_SPOTIFY,
        ).catch(() => null);
        await kvSet(k, { url }).catch(() => {});
      }
    });
  }

  const szukanyKto = sp.kto ?? "";
  const znalezieni = moja && szukanyKto.trim().length >= 2
    ? await findUsersByNick(user!.id, szukanyKto).catch(() => [])
    : [];
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
                      // Oba serwisy dobiera teraz trasa /go/stop przy kliknięciu:
                      // najpierw adres z MusicBrainz (działa też dla utworu i —
                      // co ważniejsze — dla Tidala, który bez klucza dewelopera
                      // nie ma czego szukać), potem szukanie po nazwie
                      // w Spotify, a na końcu wyszukiwarka.
                      { nazwa: "Spotify", serwis: "spotify" },
                      { nazwa: "Tidal", serwis: "tidal" },
                    ].map((s) => ({
                      ...s,
                      param: `&serwis=${s.serwis}&etykieta=${encodeURIComponent(it.label)}`,
                      // Wiemy z poprzedniego kliknięcia, że tu nic nie ma? Lupka
                      // zamiast strzałki, żeby nikt nie liczył na wejście prosto
                      // w płytę i nie zdziwił się wyszukiwarką.
                      stan: stanLinku.get(`${s.serwis}:${it.targetMbid}`),
                    })).map((s) => (
                      <a
                        key={s.nazwa}
                        href={`/go/stop?listId=${encodeURIComponent(id)}&type=${it.targetType}&mbid=${encodeURIComponent(it.targetMbid)}${s.param}`}
                        target="_blank"
                        rel="noopener"
                        title={
                          s.stan === true
                            ? fmt(t.lists.openIn, { name: s.nazwa })
                            : s.stan === false
                              ? fmt(t.lists.onlySearch, { name: s.nazwa })
                              : fmt(t.lists.notChecked, { name: s.nazwa })
                        }
                        className={`font-mono text-[10px] hover:text-accent2 ${s.stan === true ? "text-accent2" : "text-faint"}`}
                      >
                        {/* Trzy stany, bo dwa kłamały: dopóki nie sprawdzimy,
                            „strzałka" obiecywała wejście prosto w płytę. */}
                        {s.stan === true ? "▸" : s.stan === false ? "⌕" : "·"} {s.nazwa}
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

      {/* Polecanie: SZUKAMY człowieka po nazwie, nie pokazujemy spisu.
          Spis — nawet samych zgadzających się — znaczyłby, że wchodząc
          w dowolną podróż masz przed sobą wszystkich zapisanych. Tu trzeba
          wiedzieć, kogo się szuka; kto się nie zgodził, nie pojawi się wcale. */}
      {moja && (
        <section className="card">
          <h2 className="text-xl">{t.lists.shareTitle}</h2>
          <form method="get" className="mt-2 flex flex-wrap gap-2">
            <input
              name="kto"
              defaultValue={szukanyKto}
              placeholder={t.lists.shareSearchPlaceholder}
              className="input min-w-0 flex-1 py-1 text-sm"
              autoComplete="off"
            />
            <button className="btn">{t.lists.shareSearch}</button>
          </form>

          <form action={shareListAction} className="mt-3 space-y-2">
            <input type="hidden" name="listId" value={id} />
            <div className="flex flex-wrap gap-3">
              {/* Siebie widać zawsze — „poleć sobie" to kolejka do posłuchania,
                  a zgoda dotyczy pokazywania się obcym. */}
              {ludzie.filter((p) => p.me).map((p) => (
                <label key={p.id} className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" name="to" value={p.id} defaultChecked={juzPolecone.has(p.id)} />
                  {t.lists.meLabel}
                </label>
              ))}
              {znalezieni.map((p) => (
                <label key={p.id} className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" name="to" value={p.id} defaultChecked={juzPolecone.has(p.id)} />
                  {p.name}
                </label>
              ))}
            </div>
            {szukanyKto.trim().length >= 2 && !znalezieni.length && (
              <p className="text-sm text-muted">{t.lists.shareNobodyFound}</p>
            )}
            <input name="note" placeholder={t.lists.shareNote} className="input py-1 text-sm" autoComplete="off" />
            <button className="btn btn-accent">{t.lists.shareSubmit}</button>
            <p className="text-xs text-faint">{t.lists.shareNote2}</p>
          </form>
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
