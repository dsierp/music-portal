/**
 * Szkielety pokazywane, ZANIM strona się doczyta. Next.js renderuje je
 * natychmiast po kliknięciu (plik loading.tsx obok strony), więc od razu widać,
 * że coś się dzieje i mniej więcej co się pojawi — zamiast pustki, przy której
 * nie wiadomo, czy czekać, czy klikać jeszcze raz.
 *
 * MusicBrainz pozwala na 1 zapytanie na sekundę, więc kilka sekund czekania
 * na płytę czy artystę to normalna sytuacja, nie awaria.
 */
export function Bar({ w = "100%", h = 12 }: { w?: string; h?: number }) {
  return <div className="skeleton rounded" style={{ width: w, height: h }} />;
}

export function LoadingNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-6 flex items-center gap-2 font-mono text-xs text-muted">
      <span className="spinner" aria-hidden />
      {children}
    </p>
  );
}

/** Szkielet strony płyty/artysty: okładka + nagłówek + akapity. */
export function DetailSkeleton({ note }: { note: string }) {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div>
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="skeleton h-44 w-44 shrink-0 rounded" />
          <div className="flex-1 space-y-3 pt-2">
            <Bar w="30%" h={10} />
            <Bar w="70%" h={34} />
            <Bar w="45%" h={18} />
            <div className="flex gap-2 pt-2"><Bar w="90px" h={22} /><Bar w="70px" h={22} /></div>
          </div>
        </div>
        <div className="mt-8 space-y-2">
          <Bar w="100%" /><Bar w="95%" /><Bar w="60%" />
        </div>
        <LoadingNote>{note}</LoadingNote>
      </div>
      <aside className="space-y-3">
        <div className="skeleton h-40 rounded" />
        <div className="skeleton h-56 rounded" />
      </aside>
    </div>
  );
}

/** Szkielet listy (premiery, best of, wyniki wyszukiwania). */
export function ListSkeleton({ note, rows = 6 }: { note: string; rows?: number }) {
  return (
    <div>
      <Bar w="240px" h={30} />
      <div className="mt-6 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="skeleton h-14 w-14 shrink-0 rounded" />
            <div className="flex-1 space-y-2">
              <Bar w={`${55 + ((i * 7) % 30)}%`} />
              <Bar w="30%" h={10} />
            </div>
          </div>
        ))}
      </div>
      <LoadingNote>{note}</LoadingNote>
    </div>
  );
}
