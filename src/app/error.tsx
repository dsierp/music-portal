"use client";
import Link from "next/link";
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="py-20 text-center">
      <h1 className="text-4xl">Coś poszło nie tak</h1>
      <p className="mt-2 text-sm text-muted">{error.message}</p>
      <p className="mt-1 text-xs text-faint">Najczęściej: MusicBrainz chwilowo nie odpowiada (limit zapytań) albo brak połączenia z bazą.</p>
      <div className="mt-6 flex justify-center gap-2">
        <button onClick={reset} className="btn btn-accent">Spróbuj ponownie</button>
        <Link href="/" className="btn">Strona główna</Link>
      </div>
    </div>
  );
}
