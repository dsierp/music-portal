"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * „Wstecz" — dla telefonu i dla aplikacji dodanej do ekranu głównego.
 *
 * W przeglądarce na komputerze przycisk cofania jest w oknie i nikt go tu nie
 * potrzebuje. Na telefonie — a zwłaszcza po dodaniu portalu do ekranu głównego,
 * gdzie strona chodzi bez paska adresu — nie ma GO WCALE: wejście w płytę
 * z premier kończyło się szukaniem gestu albo zamknięciem aplikacji. Stąd ten
 * guzik: widoczny na ekranach dotykowych i w aplikacji z ekranu głównego, i tylko wtedy, gdy jest dokąd
 * wracać (na pierwszym ekranie po otwarciu historia jest pusta).
 */
export function Wstecz({ label }: { label: string }) {
  const router = useRouter();
  const [jest, setJest] = useState(false);
  // Nagłówek żyje przez całą wizytę i NIE montuje się od nowa przy przejściu
  // na kolejną stronę. Sprawdzane raz, na starcie, dawało „nie ma dokąd
  // wracać" już na zawsze — guzik nie pojawiał się nigdy po otwarciu aplikacji
  // z ekranu głównego. Dlatego pytamy ponownie po każdej zmianie adresu.
  const sciezka = usePathname();
  useEffect(() => {
    // `history.length > 1` to jedyne, co przeglądarka o tym mówi — nie da się
    // sprawdzić, czy poprzedni wpis jest nasz. Na telefonie wystarcza.
    setJest(typeof window !== "undefined" && window.history.length > 1);
  }, [sciezka]);
  if (!jest) return null;
  return (
    <button
      type="button"
      onClick={() => router.back()}
      aria-label={label}
      title={label}
      className="bez-paska -ml-1 mr-1 rounded px-2 py-1 text-lg leading-none text-muted hover:text-accent2"
    >
      ←
    </button>
  );
}
