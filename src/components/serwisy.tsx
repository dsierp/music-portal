import Link from "next/link";

/**
 * Dwa przyciski: posłuchaj w Spotify, posłuchaj w Tidalu. Jedno miejsce.
 *
 * Wcześniej każdy ekran rysował je po swojemu i — co gorsza — prowadził
 * WPROST do wyszukiwarki serwisu. Przy tytule w rodzaju „III" taka wyszukiwarka
 * pokazuje wszystko oprócz szukanej płyty, więc przycisk wyglądał jak zepsuty.
 *
 * Teraz oba idą przez naszą trasę `/go/serwis`, która adres ustala DOPIERO przy
 * kliknięciu: pyta MusicBrainz, a gdy ten nie wie — katalog serwisu po nazwie.
 * Dzięki temu trafia w konkretną płytę, a wyszukiwarka zostaje ostatnią deską
 * ratunku zamiast być regułą. Przy okazji wyjście zapisuje się w dzienniku
 * („puszczone z portalu"), co przy Tidalu jest JEDYNYM śladem odsłuchania,
 * jaki w ogóle mamy — ich API nie oddaje ani historii, ani „co teraz gra".
 */
export function SerwisyPills({
  etykieta,
  mbid,
  typ = "release-group",
  small = false,
  className = "",
}: {
  /** „Artysta – Tytuł" (albo sama nazwa artysty przy typ=artist) */
  etykieta: string;
  /** MBID, gdy znany — wtedy trasa pyta najpierw MusicBrainz */
  mbid?: string | null;
  typ?: "release-group" | "artist";
  small?: boolean;
  className?: string;
}) {
  const pill = "rounded-full border px-3 py-1 font-mono transition-colors";
  const adres = (serwis: "spotify" | "tidal") =>
    `/go/serwis?serwis=${serwis}&typ=${typ}&mbid=${encodeURIComponent(mbid ?? "")}&etykieta=${encodeURIComponent(etykieta)}`;
  return (
    <div className={`flex flex-wrap items-center gap-2 ${small ? "text-[11px]" : "text-xs"} ${className}`}>
      <Link href={adres("spotify")} prefetch={false} className={`${pill} border-spotify/40 text-spotify hover:bg-spotify/10`}>
        ▸ Spotify
      </Link>
      <Link href={adres("tidal")} prefetch={false} className={`${pill} border-tidal/40 text-tidal hover:bg-tidal/10`}>
        ▸ Tidal
      </Link>
    </div>
  );
}
