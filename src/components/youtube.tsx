import { i18n } from "@/lib/t";

/**
 * Wyjście w YouTube — zwykły odnośnik, nie odtwarzacz.
 *
 * WCZEŚNIEJ była tu osadzona ramka z „playlistą wyszukiwania"
 * (`listType=search`). To była sztuczka na obejście YouTube Data API i
 * przestała działać: ramka pokazuje dziś „Ten film jest niedostępny" i tyle.
 * Zepsuty odtwarzacz jest gorszy niż jego brak — wygląda, jakby popsuł się
 * portal, a nie cudza wtyczka. Konkretne klipy są wyżej, w „Teledyskach";
 * to tutaj jest zwykłe „zobacz resztę u nich".
 */
export async function YoutubeVideos({ query }: { query: string }) {
  const { t } = await i18n();
  const q = encodeURIComponent(query);
  return (
    <p className="mt-6">
      <a
        href={`https://www.youtube.com/results?search_query=${q}`}
        target="_blank"
        rel="noopener"
        className="text-sm text-muted hover:text-accent2"
      >
        {t.common.ytMore} →
      </a>
    </p>
  );
}
