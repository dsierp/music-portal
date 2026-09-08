import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Masthead } from "@/components/masthead";
import { heroArt, leadStyle } from "@/lib/lead-style";
import { currentUser } from "@/lib/auth";
import { getAreas, getFavoriteArtists, getGenres } from "@/lib/user-data";
import { concertWindow, concertsByArea, concertsByAreaMb, concertsForFavorites, dedupe, hasTicketmasterKey, type Concert } from "@/lib/concerts";
import { dbSafe } from "@/lib/db-safe";

export const metadata: Metadata = { title: "Koncerty" };
export const dynamic = "force-dynamic";

const MIESIACE = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];

/** „2026-10-04" → „4 października", bo tak się o koncertach mówi. */
function plDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const rok = new Date().getUTCFullYear() === y ? "" : ` ${y}`;
  return `${d} ${MIESIACE[m - 1]}${rok}`;
}

function ConcertList({ items }: { items: Concert[] }) {
  return (
    <ul className="space-y-2">
      {items.map((c) => (
        <li key={c.id} className="rounded-lg border border-rule bg-surface2 px-3 py-2">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <span className="font-mono text-xs text-accent2">{plDate(c.date)}{c.time ? `, ${c.time.slice(0, 5)}` : ""}</span>
            {c.url ? (
              <a href={c.url} target="_blank" rel="noopener" className="display text-lg leading-tight hover:text-accent2 hover:underline">{c.name}</a>
            ) : (
              <span className="display text-lg leading-tight">{c.name}</span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-xs text-muted">
            {c.venue && <span>{c.venue}</span>}
            {c.city && <span>· {c.city}{c.country ? `, ${c.country}` : ""}</span>}
            {c.artistName && (
              <span>
                · z Twoich ulubionych:{" "}
                <Link href={`/artist/${c.artistMbid}`} className="hover:text-accent2 hover:underline">★ {c.artistName}</Link>
              </span>
            )}
            <span className="font-mono text-[10px] text-faint">{c.source === "ticketmaster" ? "Ticketmaster" : "MusicBrainz"}</span>
          </div>
          {c.genres.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {c.genres.slice(0, 3).map((g) => <span key={g} className="chip text-[10px]">{g}</span>)}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Koncerty w moich obszarach — osobny strumień, bo to kilka zapytań do TM. */
async function ByArea({ areas, categories }: { areas: { country: string; city: string | null }[]; categories: string[] }) {
  // MusicBrainz zawsze (za darmo), Ticketmaster gdy jest klucz — i scalamy,
  // bo dla czytelnika to jedna lista koncertów w jego mieście.
  const [mb, tm] = await Promise.all([
    concertsByAreaMb(areas).catch(() => []),
    concertsByArea(areas, categories).catch(() => []),
  ]);
  const items = dedupe([...tm, ...mb]);
  if (!items.length) {
    return (
      <p className="text-sm text-muted">
        Nic nie znalazłam w Twoich obszarach na najbliższe trzy miesiące.
        {!hasTicketmasterKey() && " MusicBrainz to katalog nagrań, nie afisz koncertowy — zapowiedzi ma niewiele."}
      </p>
    );
  }
  return <ConcertList items={items} />;
}

/** Koncerty ulubionych zespołów — MusicBrainz, jedno zapytanie na zespół (1/s). */
async function ByFavorites({ artists, areas }: { artists: { mbid: string; name: string }[]; areas: { country: string; city: string | null }[] }) {
  const items = await concertsForFavorites(artists, areas).catch(() => []);
  if (!items.length) {
    return <p className="text-sm text-muted">MusicBrainz nie ma zapowiedzi Twoich ulubionych zespołów na ten okres.</p>;
  }
  return <ConcertList items={items} />;
}

export default async function ConcertsPage() {
  const user = await currentUser();
  const { from, to } = concertWindow();

  if (!user) {
    return (
      <>
        <Masthead art={heroArt(null)} eyebrow="Koncerty" title="Co gra w okolicy" />
        <p className="mt-8 text-sm text-muted">
          <Link href="/login" className="underline">Zaloguj się</Link> i wskaż w profilu miasta albo kraje, które Cię
          interesują — pokażę koncerty na najbliższe trzy miesiące, w Twoich gatunkach i z Twoich ulubionych zespołów.
        </p>
      </>
    );
  }

  const [areasS, genresS, favsS] = await Promise.all([
    dbSafe(getAreas(user.id), [] as Awaited<ReturnType<typeof getAreas>>),
    dbSafe(getGenres(user.id), [] as Awaited<ReturnType<typeof getGenres>>),
    dbSafe(getFavoriteArtists(user.id), [] as Awaited<ReturnType<typeof getFavoriteArtists>>),
  ]);
  const allAreas = areasS.value;
  const genreAreas = allAreas.filter((a) => a.scope === "genres");
  const favAreas = allAreas.filter((a) => a.scope === "favorites");
  const genres = genresS.value;
  const favs = favsS.value;
  const lead = leadStyle(genres);
  const categories = genres.filter((g) => g.weight >= 3).map((g) => g.genre);

  return (
    <>
      <Masthead
        art={heroArt(lead)}
        eyebrow="Koncerty"
        title="Co gra w okolicy"
        meta={
          <>
            <span>{plDate(from)} – {plDate(to)}</span>
            <span className="ml-4">
              {allAreas.length
                ? allAreas.map((a) => (a.city ? `${a.city} (${a.country})` : a.country)).join(" · ")
                : <Link href="/ja#obszary" className="underline">Ustaw swoje obszary</Link>}
            </span>
          </>
        }
      />

      <div className="mt-8 space-y-10">
        <section>
          <h2 className="text-3xl">W Twoich gatunkach</h2>
          <p className="mb-3 text-sm text-muted">
            Z listy &bdquo;dla moich gatunków&rdquo; w profilu.{" "}
            {hasTicketmasterKey()
              ? "Ticketmaster filtruje po Twoich kategoriach (waga 3+), MusicBrainz dokłada, co wie o tych miastach."
              : "Bez klucza do Ticketmastera lecimy na samym MusicBrainz — a ten nie zna gatunków wydarzeń, więc to wszystko, co ma o tych miastach."}{" "}
            <Link href="/ja#obszary" className="underline">Zmień obszary</Link>
          </p>
          {!genreAreas.length ? (
            <p className="text-sm text-muted">
              Nie masz jeszcze żadnego obszaru. <Link href="/ja#obszary" className="underline">Dodaj miasto albo kraj</Link>,
              a pokażę, co tam gra.
            </p>
          ) : (
            <Suspense fallback={<p className="font-mono text-xs text-muted">Sprawdzam, co gra w Twoich miastach…</p>}>
              <ByArea areas={genreAreas} categories={categories} />
            </Suspense>
          )}
        </section>

        <section>
          <h2 className="text-3xl">Twoje ulubione zespoły</h2>
          <p className="mb-3 text-sm text-muted">
            {favAreas.length
              ? `Zawężone do listy „dla ulubionych": ${favAreas.map((a) => (a.city ? `${a.city} (${a.country})` : a.country)).join(", ")}.`
              : "Bez zawężenia — jeśli zespół z gwiazdką gdziekolwiek gra i MusicBrainz o tym wie, zobaczysz to tutaj."}
          </p>
          {!favs.length ? (
            <p className="text-sm text-muted">Nie masz jeszcze ulubionych zespołów — oznacz je gwiazdką na stronie zespołu.</p>
          ) : (
            <Suspense fallback={<p className="font-mono text-xs text-muted">Pytam o trasy Twoich zespołów…</p>}>
              <ByFavorites artists={favs.map((f) => ({ mbid: f.mbid, name: f.name }))} areas={favAreas} />
            </Suspense>
          )}
        </section>
      </div>
    </>
  );
}
