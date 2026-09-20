"use client";
import { useEffect, useState } from "react";

/**
 * „Skopiuj adres tej strony" — znów rzecz wyłącznie telefonowa.
 *
 * Po dodaniu portalu do ekranu głównego strona chodzi bez paska adresu, więc
 * nie ma SKĄD tego adresu wziąć: ani go zaznaczyć, ani podać komuś płyty,
 * którą się właśnie czyta. Guzik stoi obok „wstecz", bo obie te rzeczy
 * odbiera się tak samo — jako brakujący kawałek przeglądarki.
 *
 * Najpierw próbujemy systemowego okna udostępniania (`navigator.share`) — na
 * telefonie to jest to, czego człowiek oczekuje: wyślij na Messengera, wrzuć
 * do notatek. Gdy go nie ma, kopiujemy do schowka. Gdy i schowek jest
 * zamknięty (starsze przeglądarki, strona bez HTTPS), zostaje stara sztuczka
 * z niewidocznym polem tekstowym. Dopiero gdy i to padnie, mówimy wprost, że
 * się nie udało — cicha porażka przy kopiowaniu jest najgorsza z możliwych,
 * bo człowiek wkleja Bóg wie co.
 */
export function Udostepnij({ label, copied, failed }: { label: string; copied: string; failed: string }) {
  const [stan, setStan] = useState<"" | "ok" | "blad">("");

  // Komunikat gaśnie sam — to potwierdzenie, nie ostrzeżenie do zamykania.
  useEffect(() => {
    if (!stan) return;
    const id = setTimeout(() => setStan(""), 2000);
    return () => clearTimeout(id);
  }, [stan]);

  async function kliknij() {
    const adres = window.location.href;
    const tytul = document.title;
    try {
      if (navigator.share) {
        await navigator.share({ title: tytul, url: adres });
        return; // systemowe okno samo mówi, co się stało — nie dubluj
      }
      await navigator.clipboard.writeText(adres);
      setStan("ok");
      return;
    } catch (e) {
      // Zamknięcie systemowego okna udostępniania to nie błąd — tak przeglądarki
      // zgłaszają „rozmyśliłem się", a czerwony komunikat po cofnięciu się
      // wyglądałby na awarię portalu.
      if (e instanceof DOMException && (e.name === "AbortError" || e.name === "NotAllowedError")) return;
    }
    try {
      const pole = document.createElement("textarea");
      pole.value = adres;
      pole.setAttribute("readonly", "");
      pole.style.position = "fixed";
      pole.style.opacity = "0";
      document.body.appendChild(pole);
      pole.select();
      const udane = document.execCommand("copy");
      document.body.removeChild(pole);
      setStan(udane ? "ok" : "blad");
    } catch {
      setStan("blad");
    }
  }

  return (
    <span className="relative md:hidden">
      <button
        type="button"
        onClick={kliknij}
        aria-label={label}
        title={label}
        className="rounded px-2 py-1 text-base leading-none text-muted hover:text-accent2"
      >
        {stan === "ok" ? "✓" : "⧉"}
      </button>
      {stan && (
        <span
          role="status"
          className="absolute left-1/2 top-full z-30 mt-1 -translate-x-1/2 whitespace-nowrap rounded border border-rule bg-surface px-2 py-1 font-mono text-[10px] text-text2"
        >
          {stan === "ok" ? copied : failed}
        </span>
      )}
    </span>
  );
}
