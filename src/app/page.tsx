import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { latestSections, releasesFor, bestOfYears, bestOf, BEST_CATS } from "@/lib/lists";
import { Kafelki } from "@/components/kafelki";
import { SearchBox } from "@/components/search-box";
import { Banner } from "@/components/banner";
import { Suspense } from "react";
import { SluchaszTeraz } from "@/components/teraz";
import { lineupNews } from "@/lib/lineup-news";
import { getFavoriteArtists, getGenres, getLikedAlbums, getMyLists, kolejkaDoPosluchania, listsForMe, recentComments, travelJournal } from "@/lib/user-data";
import { ostatnieKafelki } from "@/lib/grane";
import { TravelJournal } from "@/components/travel-journal";
import { spotifyConfigured } from "@/lib/spotify";
import { journeyFromReleases } from "@/app/actions";
import type { JournalEvent } from "@/lib/journal";
import { genreToSection } from "@/lib/genres";
import { SKIP_ONBOARDING } from "@/lib/onboarding";
import { i18n } from "@/lib/t";
import { ScreenHelp } from "@/components/screen-help";
import { fmt, formatDate, plural, type Locale } from "@/lib/i18n";
import { genreLabel } from "@/lib/dict";
import type { Dict } from "@/lib/dict";

export const dynamic = "force-dynamic";

/**
 * „Kto zmienił zespół" — osobny strumień, bo to jedno zapytanie do MusicBrainz
 * na zespół (limit 1/s). Strona główna nie ma na to czekać.
 */
/**
 * Zmiany w składach ulubionych zespołów.
 *
 * Ta sekcja znikała bez słowa, gdy ktoś nie miał jeszcze ani jednego zespołu
 * z gwiazdką — a przewodnik „jak się tu poruszać" obiecywał ją bezwarunkowo.
 * Z punktu widzenia patrzącego wyglądało to na obietnicę bez pokrycia. Teraz
 * mówimy, czego brakuje i gdzie to ustawić, zamiast chować cały nagłówek.
 *
 * Niezalogowanemu nie pokazujemy nic: on nie ma gdzie postawić gwiazdki.
 */
async function LineupNews({ bands, favorites, zalogowany, t }: { bands: { mbid: string; name: string }[]; favorites: Set<string>; zalogowany: boolean; t: Dict["home"] }) {
  if (!zalogowany) return null;
  const news = bands.length ? await lineupNews(bands, favorites).catch(() => []) : [];
  if (!news.length) {
    return (
      <section>
        <h2 className="text-3xl">{t.lineupTitle}</h2>
        <p className="mt-2 text-sm text-muted">{bands.length ? t.lineupNoNews : t.lineupEmpty}</p>
      </section>
    );
  }
  return (
    <section>
      <h2 className="text-3xl">{t.lineupTitle}</h2>
      <p className="mb-3 text-sm text-muted">{t.lineupNote}</p>
      <ul className="space-y-1.5">
        {news.map((n, i) => (
          <li key={`${n.artistMbid}-${n.personMbid}-${n.kind}-${i}`} className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className={n.kind === "joined" ? "text-ok" : "text-warn"}>{n.kind === "joined" ? "+" : "−"}</span>
            <Link href={`/artist/${n.personMbid}`} className="font-medium hover:text-accent2 hover:underline">{n.personName}</Link>
            <span className="text-muted">{n.kind === "joined" ? t.joined : t.left}</span>
            <Link href={`/artist/${n.artistMbid}`} className="font-medium hover:text-accent2 hover:underline">
              {n.favorite && <span className="text-accent2">★ </span>}{n.artistName}
            </Link>
            {n.roles.length > 0 && <span className="font-mono text-[10px] text-faint">{n.roles.join(", ")}</span>}
            <span className="font-mono text-[10px] text-muted">{n.date}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Strona główna jest ZAJAWKĄ, nie spisem treści.
 *
 * Wcześniej wywalała tu całe sekcje premier — po kilkanaście pozycji na
 * tydzień. Kto wchodzi codziennie, przewijał to samo; kto pierwszy raz, dostawał
 * ścianę. Teraz: trzy rzeczy z własnej kolejki i po JEDNEJ premierze z każdej
 * kategorii. Reszta jest w Premierach, dwa kliknięcia stąd.
 */
/**
 * Koncerty jako zajawka — trzy najbliższe, osobnym strumieniem.
 *
 * Osobno, bo to pytanie do Ticketmastera i MusicBrainz: strona główna ma się
 * pokazać od razu, a koncerty doklejają się, gdy przyjdą. Gdy nie ma czego
 * pokazać, sekcja po prostu nie istnieje — pusta rubryka „koncerty" jest
 * gorsza niż jej brak.
 */
async function KoncertyZajawka({ userId, t, locale }: { userId: string; t: Dict; locale: Locale }) {
  const { getAreas, getGenres } = await import("@/lib/user-data");
  const [areas, genres] = await Promise.all([
    getAreas(userId).catch(() => []),
    getGenres(userId).catch(() => []),
  ]);
  if (!areas.length) return null;
  const { concertsByArea, concertsByAreaMb, dedupe, zgadnijZespol } = await import("@/lib/concerts");
  const kategorie = genres.map((g) => g.genre);
  const [mb, tm] = await Promise.all([
    concertsByAreaMb(areas).catch(() => []),
    concertsByArea(areas, kategorie).catch(() => []),
  ]);
  const items = dedupe([...tm, ...mb]).slice(0, 3);
  if (!items.length) return null;
  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h2 className="text-3xl">{t.home.concertsSoon}</h2>
        <Link href="/koncerty" className="text-sm text-muted hover:text-accent2">{t.common.showAll} →</Link>
      </div>
      <ul className="mt-3 space-y-2 text-sm">
        {items.map((c) => {
          // Kto gra — i od razu droga do posłuchania. Sam afisz („Tech It Easy
          // Tour! 2026") nic nie mówi: żeby zdecydować, czy tam iść, trzeba
          // usłyszeć. Nazwy zespołów prowadzą na ich strony u nas, a stamtąd
          // w Spotify czy Tidala. Dokładnie to samo jest na /koncerty.
          const kto = (c.lineup?.length ? c.lineup : c.artistName ? [c.artistName] : []).slice(0, 4);
          // Gdy źródło nie podało składu, zgadujemy zespół z tytułu i dajemy
          // wyszukanie — lepsze to niż afisz, z którego nie da się nic kliknąć.
          const zgadniety = kto.length ? null : zgadnijZespol(c.name);
          return (
            <li key={c.id}>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-mono text-[10px] text-faint">{formatDate(c.date, locale)}</span>
                <span className="font-medium">{c.name}</span>
                <span className="text-muted">{c.city}</span>
                {c.url && (
                  <a href={c.url} target="_blank" rel="noopener" className="text-xs text-muted hover:text-accent2">→</a>
                )}
              </div>
              {kto.length === 0 && zgadniety && (
                <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-xs">
                  <span className="text-faint">{t.concerts.listenBefore}</span>
                  <Link href={`/szukaj?q=${encodeURIComponent(zgadniety)}`} className="text-muted underline decoration-dotted hover:text-accent2">
                    {zgadniety}
                  </Link>
                </div>
              )}
              {kto.length > 0 && (
                <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-xs">
                  <span className="text-faint">{t.concerts.listenBefore}</span>
                  {kto.map((nazwa) => (
                    <Link
                      key={nazwa}
                      href={c.lineupIds?.[nazwa] ? `/artist/${c.lineupIds[nazwa]}` : `/go/mb?typ=artist&nazwa=${encodeURIComponent(nazwa)}`}
                      className="text-muted underline decoration-dotted hover:text-accent2"
                    >
                      {nazwa}
                    </Link>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default async function Home({ searchParams }: { searchParams: Promise<{ wszystko?: string }> }) {
  const wszystko = (await searchParams).wszystko === "1";
  const { locale, t } = await i18n();
  const user = await currentUser();
  // Pierwsze wejście po zalogowaniu: nikt nie ma jeszcze stylów, a bez nich
  // portal nie wie, co komu pokazywać — więc zamiast wpuszczać na stronę
  // główną z domyślną oprawą, prowadzimy prosto do wyboru gatunków.
  // „Później" ustawia ciasteczko i drugi raz już nie zaczepiamy.
  if (user && !(await cookies()).get(SKIP_ONBOARDING)?.value) {
    const genres = await getGenres(user.id).catch(() => [] as { genre: string; weight: number }[]);
    if (!genres.length) redirect("/ja?witaj=1");
  }
  const sections = await latestSections(2);
  const rel = await releasesFor(sections.map((s) => s.id));
  const years = await bestOfYears();
  const best = years[0] ? await bestOf(years[0].year) : null;
  const recent = await recentComments(6);

  let prefSections: Set<string> | null = null;
  let liked: Awaited<ReturnType<typeof getLikedAlbums>> = [];
  let favs: Awaited<ReturnType<typeof getFavoriteArtists>> = [];
  let odrzucone: Awaited<ReturnType<typeof getLikedAlbums>> = [];
  let mojeListy: Awaited<ReturnType<typeof getMyLists>> = [];
  let dlaMnie: Awaited<ReturnType<typeof listsForMe>> = [];
  let dziennik: JournalEvent[] = [];
  let kolejka: Awaited<ReturnType<typeof kolejkaDoPosluchania>> = null;
  let ostatnio: Awaited<ReturnType<typeof ostatnieKafelki>> = [];
  if (user) {
    const genres = await getGenres(user.id);
    const s = new Set(genres.filter((g) => g.weight >= 3).map((g) => genreToSection(g.genre)).filter(Boolean) as string[]);
    prefSections = s.size ? s : null;
    [liked, favs, odrzucone] = await Promise.all([
      getLikedAlbums(user.id),
      getFavoriteArtists(user.id),
      getLikedAlbums(user.id, "dislike").catch(() => []),
    ]);
    // Listy na stronie głównej: to jest to, po co człowiek tu wraca — własna
    // kolejka do posłuchania i to, co ktoś mu podsunął.
    [mojeListy, dlaMnie, dziennik] = await Promise.all([
      getMyLists(user.id).catch(() => []),
      listsForMe(user.id).catch(() => []),
      // Dziennik: ślad po tym, co człowiek tu porobił. Awaria nie ma wywalać
      // strony głównej — najwyżej nie będzie tej jednej karty.
      travelJournal(user.id, 12).catch(() => []),
    ]);
    kolejka = await kolejkaDoPosluchania(user.id, 12).catch(() => null);
    // Suma obu źródeł: to, co właśnie leci, i to, co puszczone z portalu —
    // przy kafelku widać, skąd jest. Rozdzielone są na /grane.
    ostatnio = await ostatnieKafelki(user.id, 12).catch(() => []);
  }
  /**
   * Jedna zaczepka: coś z best of, czego jeszcze nie tykałeś.
   *
   * Bierzemy z rankingów portalu, a nie od modelu — zaczepka na stronie
   * głównej ma być natychmiastowa i darmowa. Odsiewamy to, co już polubione
   * albo odrzucone; reszta idzie po kolei, a nie losowo, żeby strona nie
   * skakała przy każdym odświeżeniu.
   */
  const znane = new Set([...liked.map((a) => a.mbid), ...odrzucone.map((a) => a.mbid)]);
  /**
   * Kategorie best of trzymają death i black osobno, a preferencje użytkownika
   * schodzą przez genreToSection do wspólnego "db" — stąd to jedno przejście.
   */
  const bestCatToSection = (cat: string) => (cat === "death" || cat === "black" ? "db" : cat);
  const kandydaci =
    user && best ? best.entries.filter((e) => e.rank === 1 && e.mbid && !znane.has(e.mbid)) : [];
  /**
   * Najpierw z gatunków, które człowiek ma w profilu. Bez tego karta pokazywała
   * po prostu #1 rankingu roku — a #1 rankingu roku bywa indie folkiem u kogoś,
   * kto słucha death metalu. Gdy w jego gatunkach nie ma już nic nietkniętego,
   * wracamy do całej puli: lepiej podsunąć coś z boku niż nie pokazać nic.
   */
  const swoje = prefSections
    ? kandydaci.filter((e) => prefSections.has(bestCatToSection(e.category)))
    : [];
  const pula = swoje.length ? swoje : kandydaci;
  const sprobuj = pula.length ? pula[new Date().getUTCDate() % pula.length] ?? null : null;
  const sprobujWSwoim = swoje.length > 0;

  const stars = rel.filter((r) => r.star === 1 && (!prefSections || prefSections.has(r.genre)));

  /**
   * Łagodne wejście dla nieznajomego.
   *
   * Portal jest o metalu i progu i nie udaje inaczej — ale ktoś, kto trafia tu
   * pierwszy raz, dostawał na dzień dobry ścianę bestial black metalu. To nie
   * jest zaproszenie, tylko test na wytrzymałość. Więc dla niezalogowanego
   * zaczynamy od spokojniejszych kategorii, a ciężkie są jedno kliknięcie obok
   * — nie chowamy ich, tylko nie wpychamy w drzwiach.
   */
  const SPOKOJNE = new Set(["pop", "jazz", "folk", "classical", "country", "electronic"]);
  const zajawka = user || wszystko ? stars : stars.filter((r) => SPOKOJNE.has(r.genre));

  // Po JEDNEJ pozycji z kategorii: strona główna ma dawać próbkę, a nie spis.
  const widzianeKategorie = new Set<string>();
  const poJednym = (zajawka.length ? zajawka : stars).filter((r) => {
    if (widzianeKategorie.has(r.genre)) return false;
    widzianeKategorie.add(r.genre);
    return true;
  });

  // Zmiany składów sprawdzamy w Twoich ulubionych zespołach (★).
  // Premier tu nie doważamy: tabela premier trzyma MBID PŁYTY, nie zespołu, więc
  // pytanie o nie MusicBrainz kończyłoby się serią chybionych zapytań. Żeby objąć
  // tym całe kategorie, trzeba najpierw rozwiązać artystów — osobny temat.
  const favMbids = new Set(favs.map((f) => f.mbid));
  const newsBands = favs.map((f) => ({ mbid: f.mbid, name: f.name })).slice(0, 10);

  return (
    <div className="space-y-10">
      <Banner image="/img/studio.jpg" title={t.home.heroTitle} position="center 40%">
        <p className="mt-3 max-w-2xl text-text2">
          {t.home.heroTextBefore}
          <b className="text-text">{t.home.heroTextBold}</b>{t.home.heroTextAfter}
        </p>
        <div className="mt-5 max-w-xl"><SearchBox big placeholder={t.nav.searchPlaceholder} label={t.nav.search} /></div>
        {!user && <p className="mt-3 text-sm text-muted"><Link href="/login" className="underline">{t.home.loginCta}</Link>{t.home.loginPromptRest}</p>}
      </Banner>
      <ScreenHelp screen="start" />

      {/* Lewa kolumna to jedno pudełko, a nie trzy komórki siatki.
          Dotad "zmiany w skladach", premiery i pasek boczny byly trzema
          dziecmi tej samej siatki — dopoki zmiany zwracaly null, premiery
          wskakiwaly w szeroka kolumne i wszystko wygladalo dobrze. Gdy zmiany
          zaczely renderowac sie zawsze (takze puste), zajely szeroka kolumne
          i zepchnely premiery do paska 320 px: tytuly lamaly sie po jednym
          slowie, a przyciski wchodzily na tekst. Teraz kolejnosc w kolumnie
          nie rusza szerokosci. */}
      <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
        <div className="space-y-10">
        {/* Kolejka PRZED premierami, bo to rzecz, po którą się tu wraca:
            premiery są nowe co piątek, a to jest to, co człowiek sam sobie
            odłożył i czego jeszcze nie posłuchał. */}
        {kolejka && (
          <section>
            <div className="flex items-baseline justify-between">
              <h2 className="text-3xl">{kolejka.title}</h2>
              <Link href={`/podroz/${kolejka.id}`} className="text-sm text-muted hover:text-accent2">
                {t.common.showAll} <span className="font-mono text-xs text-faint">({kolejka.ile})</span> →
              </Link>
            </div>
            <Kafelki
              items={kolejka.items.map((i) => ({
                key: `${i.targetType}-${i.targetMbid}`,
                href:
                  i.targetType === "ARTIST"
                    ? `/artist/${i.targetMbid}`
                    : i.targetType === "CONCERT"
                      ? i.url ?? "/koncerty"
                      : `/album/${i.targetMbid}`,
                mbid: i.targetType === "ALBUM" ? i.targetMbid : null,
                title: i.label.split(" – ").slice(1).join(" – ") || i.label,
                subtitle: i.label.split(" – ")[0],
              }))}
            />
          </section>
        )}
        {/* „Ostatnio" — kolejność jak w serwisach, do których ludzie są
            przyzwyczajeni: najpierw to, co odłożyli, potem to, czego właśnie
            słuchali. Okładki, bo płyty rozpoznaje się po nich, nie po tytule. */}
        {ostatnio.length > 0 && (
          <section>
            <div className="flex items-baseline justify-between">
              <h2 className="text-3xl">{t.home.recentTitle}</h2>
              <Link href="/grane" className="text-sm text-muted hover:text-accent2">{t.common.showAll} →</Link>
            </div>
            <Kafelki
              items={ostatnio.map((o) => ({
                key: `${o.artist}-${o.album}`,
                href: o.mbid
                  ? `/album/${o.mbid}`
                  : `/go/mb?typ=album&nazwa=${encodeURIComponent(o.album)}&artysta=${encodeURIComponent(o.artist)}`,
                cover: o.cover,
                mbid: o.mbid,
                title: o.album,
                subtitle: o.artist,
                meta: o.zPortalu ? t.lists.playedFrom : null,
              }))}
            />
          </section>
        )}
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-3xl">{prefSections ? t.home.releasesForYou : t.home.releasesThisWeek}</h2>
            <Link href="/premiery" className="text-sm text-muted hover:text-accent2">{t.home.allReleases}</Link>
          </div>
          <p className="mt-1 text-xs text-muted">{t.home.oneEach}</p>
          {/* Gość dostaje łagodniejsze wejście. Portal jest o metalu i progu,
              ale witanie kogoś z ulicy ścianą bestial black metalu to nie
              zaproszenie, tylko test na wytrzymałość — a wybór jest obok. */}
          {!user && (
            <p className="mt-2 text-xs text-faint">
              {wszystko ? "" : `${t.home.guestGenres} `}
              <Link href={wszystko ? "/" : "/?wszystko=1"} className="underline hover:text-accent2">
                {wszystko ? t.home.guestBack : t.home.guestShowAll}
              </Link>
            </p>
          )}
          <Kafelki
            items={poJednym.map((r) => ({
              key: r.id,
              href: r.mbid
                ? `/album/${r.mbid}`
                : `/go/mb?typ=album&nazwa=${encodeURIComponent(r.album ?? "")}&artysta=${encodeURIComponent(r.artist ?? "")}`,
              mbid: r.mbid,
              title: r.album ?? "",
              subtitle: r.artist ?? "",
              meta: genreLabel(r.genre, t),
            }))}
          />
          {/* Podróż z premier zostaje, ale już tylko z najnowszego tygodnia —
              strona główna nie jest miejscem na archiwum. */}
          {user && sections[0] && poJednym.length > 0 && (
            <form action={journeyFromReleases} className="mt-4">
              <input type="hidden" name="sectionId" value={sections[0].id} />
              <input type="hidden" name="title" value={`${sections[0].title} ${sections[0].date}`} />
              <input type="hidden" name="star" value="1" />
              <input type="hidden" name="genres" value={prefSections ? [...prefSections].join(",") : ""} />
              <button className="btn text-xs">{t.releases.journeyFromReleases}</button>
            </form>
          )}
          {!poJednym.length && <p className="mt-3 text-sm text-muted">{t.home.noReleasesBefore}<code>npm run import:pns</code>{t.home.noReleasesAfter}</p>}
        </section>

        {/* Ulubione zaraz po premierach: to jest półka, do której się wraca. */}
        {/* Płyty i zespoły OSOBNO. W jednej półce mieszały się dwie różne
            rzeczy: kafelek z okładką i kafelek bez okładki, podpisany gwiazdką.
            Oko czytało to jako jedną listę z dziurami, a to są dwie listy. */}
        {user && liked.length > 0 && (
          <section>
            <div className="flex items-baseline justify-between">
              <h2 className="text-3xl">{t.home.favouriteAlbums}</h2>
              <Link href="/ja" className="text-sm text-muted hover:text-accent2">{t.common.showAll} →</Link>
            </div>
            <Kafelki
              items={liked.slice(0, 12).map((a) => ({
                key: `l-${a.mbid}`,
                href: `/album/${a.mbid}`,
                mbid: a.mbid,
                title: a.title,
                subtitle: a.artistName,
              }))}
            />
          </section>
        )}
        {user && favs.length > 0 && (
          <Suspense fallback={null}>
            <UlubieniArtysci artysci={favs.slice(0, 12)} t={t} />
          </Suspense>
        )}

        {/* „A może by tak spróbować" — jedna rzecz z best of, której jeszcze
            nie tykałeś. Świadomie BEZ modelu językowego: to ma być zaczepka na
            stronie głównej, a nie zapytanie, które kosztuje i trwa. */}
        {sprobuj && (
          <section className="card">
            <h2 className="text-xl">{t.home.tryTitle}</h2>
            <p className="mt-1 text-xs text-muted">{t.home.tryNote}</p>
            <p className="mt-2">
              <Link href={`/go/best/${sprobuj.id}`} className="text-lg hover:text-accent2">
                {sprobuj.artist} – <i>{sprobuj.album}</i>
              </Link>
            </p>
            {/* Dlaczego akurat to: skąd się wzięło w rankingu i czy trafia w
                Twoje gatunki. Bez tej linijki karta wyglądała jak losowanie. */}
            <p className="mt-1 text-xs text-muted">
              {fmt(t.home.tryWhy, {
                miejsce: genreLabel(sprobuj.category, t, BEST_CATS[sprobuj.category] ?? sprobuj.category),
                rok: best?.year?.label ?? "",
              })}
              {" · "}
              {sprobujWSwoim ? t.home.tryWhyYours : t.home.tryWhyOutside}
            </p>
            <p className="mt-3">
              <Link
                href={`/rozmowa?opis=${encodeURIComponent(fmt(t.home.tryPrompt, { co: `${sprobuj.artist} – ${sprobuj.album}` }))}`}
                className="btn text-xs"
              >
                {t.chat.findSimilar}
              </Link>
            </p>
          </section>
        )}

        {/* Koncerty: osobnym strumieniem, bo to pytanie do Ticketmastera
            i MusicBrainz — strona główna nie ma na nie czekać. */}
        {user && (
          <Suspense fallback={null}>
            <KoncertyZajawka userId={user.id} t={t} locale={locale} />
          </Suspense>
        )}

        {/* Zmiany skladow POD premierami: to jest powod, zeby wrocic, ale nie
            pierwsza rzecz, po ktora sie tu przychodzi. */}
        <Suspense fallback={<p className="font-mono text-xs text-muted">{t.home.lineupLoading}</p>}>
          <LineupNews bands={newsBands} favorites={favMbids} zalogowany={!!user} t={t.home} />
        </Suspense>
        </div>

        <aside className="space-y-6">
          {/* Kafelek dociąga się sam, JUŻ PO wyświetleniu strony — patrz
              components/teraz.tsx. W strumieniu tej strony czekał za
              MusicBrainz i Wikipedią, czyli czasem i minutę. */}
          {user && spotifyConfigured() && <SluchaszTeraz tytul={t.home.nowPlaying} znajdz={t.home.nowPlayingFind} />}
          <TravelJournal events={dziennik} locale={locale} t={t} more="/podroze#dziennik" />
          {user && (mojeListy.length > 0 || dlaMnie.length > 0) && (
            <section className="card">
              <div className="flex items-baseline justify-between">
                <h2 className="text-xl">{t.lists.myListsTitle}</h2>
                <Link href="/podroze" className="text-xs text-muted hover:text-accent2">{t.common.showAll} →</Link>
              </div>
              {dlaMnie.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm">
                  {dlaMnie.slice(0, 4).map((l) => (
                    <li key={`s-${l.id}`} className="flex items-baseline justify-between gap-2">
                      <Link href={`/podroz/${l.id}`} className="truncate hover:text-accent2">
                        <span className="text-accent2">★ </span>{l.title}
                      </Link>
                      <span className="shrink-0 font-mono text-[10px] text-faint">{fmt(t.lists.sharedBy, { name: l.from })}</span>
                    </li>
                  ))}
                </ul>
              )}
              {mojeListy.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm">
                  {mojeListy.slice(0, 5).map((l) => (
                    <li key={l.id} className="flex items-baseline justify-between gap-2">
                      <Link href={`/podroz/${l.id}`} className="truncate hover:text-accent2">{l.title}</Link>
                      <span className="shrink-0 font-mono text-[10px] text-faint">{plural(locale, l.items, t.lists.itemsCount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          {best && (
            <section className="card">
              <div className="flex items-baseline justify-between">
                <h2 className="text-xl">{fmt(t.home.bestOfTitle, { year: best.year?.label ?? "" })}</h2>
                <Link href="/best-of" className="text-xs text-muted hover:text-accent2">{t.home.bestOfAll}</Link>
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {Object.keys(BEST_CATS).map((c) => {
                  const top = best.entries.find((e) => e.category === c && e.rank === 1);
                  if (!top) return null;
                  return (
                    <li key={c}>
                      <span className="label mr-1">{genreLabel(c, t, BEST_CATS[c])}</span>
                      <Link href={`/go/best/${top.id}`} className="hover:text-accent2">{top.artist} – <i>{top.album}</i></Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          {user && (favs.length > 0 || liked.length > 0) && (
            <section className="card">
              <h2 className="text-xl">{t.home.yours}</h2>
              {favs.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {favs.slice(0, 12).map((f) => <Link key={f.mbid} href={`/artist/${f.mbid}`} className="chip">{f.name}</Link>)}
                </div>
              )}
              {liked.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm">
                  {liked.slice(0, 6).map((a) => (
                    <li key={a.mbid}><Link href={`/album/${a.mbid}`} className="hover:text-accent2">{a.artistName} – <i>{a.title}</i></Link></li>
                  ))}
                </ul>
              )}
              <Link href="/ja" className="mt-2 block text-xs text-muted hover:text-accent2">{t.home.manageProfile}</Link>
            </section>
          )}
          {recent.length > 0 && (
            <section className="card">
              <h2 className="text-xl">{t.home.recentComments}</h2>
              <ul className="mt-2 space-y-2 text-sm">
                {recent.map((c) => (
                  <li key={c.id}>
                    <Link href={c.targetType === "ALBUM" ? `/album/${c.targetMbid}` : `/artist/${c.targetMbid}`} className="block text-text2 hover:text-accent2">
                      <span className="text-xs text-muted">{c.userName || c.userEmail.split("@")[0]}:</span> {c.body.length > 90 ? c.body.slice(0, 90) + "…" : c.body}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

/**
 * Półka ulubionych zespołów — ze zdjęciami albo logotypami.
 *
 * Kafelek artysty był pusty: płyta ma okładkę, a zespół u nas nie miał nic,
 * więc dziesięć kafelków wyglądało jak dziesięć dziur ze znakiem portalu.
 * Wikidane trzymają przy zespole plik na Commons — logo albo zdjęcie — i to
 * wystarczy, żeby półkę dało się skanować wzrokiem tak samo jak płyty.
 *
 * Osobnym strumieniem, bo to dwa zapytania na zespół: strona ma się pokazać
 * od razu, a obrazki dochodzą, gdy przyjdą. Zespoły bez wpisu w Wikidanych
 * zostają ze znakiem portalu — to nadal lepsze niż brak kafelka.
 */
async function UlubieniArtysci({ artysci, t }: { artysci: { mbid: string; name: string }[]; t: Dict }) {
  const { wdObrazArtysty } = await import("@/lib/wikidata");
  const obrazy = await Promise.all(artysci.map((a) => wdObrazArtysty(a.mbid).catch(() => null)));
  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h2 className="text-3xl">{t.home.favouriteArtists}</h2>
        <Link href="/ja" className="text-sm text-muted hover:text-accent2">{t.common.showAll} →</Link>
      </div>
      <Kafelki
        items={artysci.map((a, i) => ({
          key: `f-${a.mbid}`,
          href: `/artist/${a.mbid}`,
          cover: obrazy[i],
          title: a.name,
          subtitle: null,
        }))}
      />
    </section>
  );
}
