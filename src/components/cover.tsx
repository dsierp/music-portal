"use client";
import { useState } from "react";

/**
 * Okładka z Cover Art Archive; gdy brak — cichy placeholder zamiast ikony zepsutego obrazka.
 *
 * Komponent kliencki (stan „nie wczytało się") nie może sam wołać i18n() — `noCoverLabel`
 * ma polski domyślny tekst, żeby wywołania spoza przetłumaczonych ekranów (np. karty płyt)
 * nie musiały nic zmieniać; strona albumu podaje własne tłumaczenie.
 */
export function Cover({ mbid, size = 64, className = "", noCoverLabel = "brak okładki" }: { mbid: string; size?: number; className?: string; noCoverLabel?: string }) {
  const [failed, setFailed] = useState(false);
  const px = size >= 200 ? 500 : 250;
  return (
    <div className={`shrink-0 overflow-hidden rounded bg-surface2 ${className}`} style={{ width: size, height: size }}>
      {failed ? (
        // Znak portalu zamiast zdjęcia. Fotografia winyla wyglądała dobrze
        // pojedynczo, ale przy pięciu płytach bez okładki obok siebie robiła
        // się ściana tego samego obrazka — oko czytało ją jako treść, choć
        // treścią był tylko jej brak. Płaskie tło ze znakiem jest cicho
        // i od razu widać, że tu okładki po prostu nie ma.
        <div
          className="flex h-full w-full items-center justify-center bg-surface2"
          title={noCoverLabel}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/pns/logo.webp" alt={noCoverLabel} className="w-1/2 opacity-20" />
        </div>
      ) : (
        <img
          src={`https://coverartarchive.org/release-group/${mbid}/front-${px}`}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      )}
    </div>
  );
}
