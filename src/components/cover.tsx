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
        // Zamiast pustego prostokąta — przygaszone zdjęcie winyla, żeby lista płyt
        // bez okładek nie wyglądała na zepsutą.
        <div
          className="flex h-full w-full items-center justify-center bg-cover bg-center font-mono text-[10px] text-faint"
          style={{ backgroundImage: "linear-gradient(rgba(0,0,0,.65),rgba(0,0,0,.65)), url(/img/winyl.jpg)" }}
        >
          {noCoverLabel}
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
