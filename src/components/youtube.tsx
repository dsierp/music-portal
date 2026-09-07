/**
 * Filmiki z YouTube dla artysty — bez klucza API: osadzamy wyniki wyszukiwania
 * jako "playlistę" (parametr listType=search), więc nie trzeba nic pobierać
 * z YouTube Data API. Domyślnie zwinięte (<details>), żeby nie ładować
 * zewnętrznej ramki na każdej wizycie.
 */
export function YoutubeVideos({ query }: { query: string }) {
  const q = encodeURIComponent(query);
  return (
    <details className="mt-8 group">
      <summary className="cursor-pointer text-2xl text-text hover:text-accent2" style={{ fontFamily: "var(--font-display)" }}>
        Filmiki (YouTube)
      </summary>
      <div className="mt-3 aspect-video w-full overflow-hidden rounded-lg border border-rule bg-surface2">
        <iframe
          className="h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/videoseries?listType=search&list=${q}`}
          title={`Filmiki YouTube: ${query}`}
          loading="lazy"
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      <a
        href={`https://www.youtube.com/results?search_query=${q}`}
        target="_blank"
        rel="noopener"
        className="mt-2 inline-block text-xs text-muted hover:text-accent2"
      >
        więcej wyników na YouTube ↗
      </a>
    </details>
  );
}
