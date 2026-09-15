"use client";

/**
 * „Słuchasz teraz" — kafelek, który dociąga się sam po wyświetleniu strony.
 *
 * Był renderowany razem ze stroną główną, w jej strumieniu. A ta strona pyta
 * MusicBrainz i Wikipedię i potrafi mielić kilkadziesiąt sekund — więc kafelek
 * pojawiał się długo po tym, jak człowiek przestał go szukać, albo wcale.
 * Wyglądało to na niedziałającą funkcję, choć Spotify odpowiadał od razu.
 *
 * Przy okazji rozwiązuje drugą rzecz: utwór zmienia się co kilka minut, a
 * strona renderowana raz zostawała z nieaktualnym. Teraz odpytujemy co pół
 * minuty i tylko wtedy, gdy karta jest na wierzchu — w tle nie ma po co.
 */
import { useEffect, useState } from "react";

interface Teraz {
  title: string;
  artist: string;
  album: string;
  url: string;
  cover: string | null;
}

export function SluchaszTeraz({ tytul, znajdz }: { tytul: string; znajdz: string }) {
  const [teraz, setTeraz] = useState<Teraz | null>(null);

  useEffect(() => {
    let zyje = true;
    const pobierz = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/teraz", { cache: "no-store" });
        const dane = (await res.json()) as { teraz: Teraz | null };
        if (zyje) setTeraz(dane.teraz);
      } catch {
        // Cisza. To jest dodatek do strony, nie jej treść — nie ma o czym krzyczeć.
      }
    };
    pobierz();
    const t = setInterval(pobierz, 30_000);
    document.addEventListener("visibilitychange", pobierz);
    return () => {
      zyje = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", pobierz);
    };
  }, []);

  if (!teraz) return null;
  return (
    <section className="card">
      <div className="label mb-2">{tytul}</div>
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {teraz.cover && <img src={teraz.cover} alt="" className="h-12 w-12 rounded" />}
        <div className="min-w-0">
          <a href={teraz.url} target="_blank" rel="noopener" className="block truncate font-medium hover:text-accent2 hover:underline">
            {teraz.title}
          </a>
          <div className="truncate text-xs text-muted">{teraz.artist}</div>
        </div>
      </div>
      {/* Skok z odtwarzanego utworu do tej płyty u nas — stąd zaczyna się
          grzebanie w składzie. */}
      <a
        href={`/go/mb?typ=album&nazwa=${encodeURIComponent(teraz.album)}&artysta=${encodeURIComponent(teraz.artist)}`}
        className="mt-2 block text-xs text-muted hover:text-accent2"
      >
        {znajdz}
      </a>
    </section>
  );
}
