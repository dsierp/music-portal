"use client";
import { useState } from "react";

/** Okładka z Cover Art Archive; gdy brak — cichy placeholder zamiast ikony zepsutego obrazka. */
export function Cover({ mbid, size = 64, className = "" }: { mbid: string; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const px = size >= 200 ? 500 : 250;
  return (
    <div className={`shrink-0 overflow-hidden rounded bg-surface2 ${className}`} style={{ width: size, height: size }}>
      {failed ? (
        <div className="flex h-full w-full items-center justify-center font-mono text-[10px] text-faint">brak okładki</div>
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
