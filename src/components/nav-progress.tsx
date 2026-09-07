"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Globalny pasek postępu na górze strony — pokazuje się od razu po kliknięciu
 * w link (albo klik na przycisk formularza akcji serwera) i znika, gdy strona
 * się zmieni. Bez tego jedyną wskazówką, że coś się dzieje, jest ikonka
 * ładowania na karcie przeglądarki — łatwo to przeoczyć.
 */
export function NavProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Zmiana ścieżki/query = nawigacja się zakończyła (albo strona się przerenderowała).
  useEffect(() => {
    setActive(false);
    if (showTimer.current) clearTimeout(showTimer.current);
  }, [pathname, searchParams]);

  useEffect(() => {
    function isInternalLink(el: Element | null): el is HTMLAnchorElement {
      if (!el || !(el instanceof HTMLAnchorElement)) return false;
      const href = el.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("http") || href.startsWith("mailto:")) return false;
      if (el.target === "_blank") return false;
      return true;
    }
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement)?.closest("a");
      if (!isInternalLink(a)) return;
      if (a.getAttribute("href") === pathname) return;
      // małe opóźnienie, żeby nie migało przy błyskawicznych (już zbuforowanych) przejściach
      showTimer.current = setTimeout(() => setActive(true), 150);
    }
    function onSubmit(e: SubmitEvent) {
      const form = e.target as HTMLFormElement;
      if (form?.tagName === "FORM") showTimer.current = setTimeout(() => setActive(true), 150);
    }
    document.addEventListener("click", onClick);
    document.addEventListener("submit", onSubmit);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("submit", onSubmit);
    };
  }, [pathname]);

  if (!active) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-rule/40" aria-hidden>
      <div className="nav-progress-bar h-full w-1/3 bg-accent shadow-[0_0_8px_var(--accent)]" />
    </div>
  );
}
