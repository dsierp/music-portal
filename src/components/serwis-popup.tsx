"use client";
import { useEffect, useState } from "react";
import { SERWIS, kluczSerwisu, serwisAktualny } from "@/lib/serwis";
import type { Locale } from "@/lib/i18n";

/**
 * Okienko „Uwaga" przy wejściu do portalu.
 *
 * Pokazuje się raz na przeglądarkę, z jednym guzikiem „Rozumiem" — bez krzyżyka,
 * bez „nie pokazuj więcej", bez zamykania na Escape. Chodzi o to, żeby człowiek
 * na pewno to przeczytał, zanim uzna, że portal się zepsuł: jak przy przebudowie
 * padnie mu wykres składu, ma wiedzieć, że to my, a nie on.
 *
 * Decyzja wisi w localStorage pod kluczem z numerem wersji ogłoszenia, więc:
 * kliknięcie nie wraca przy każdym wejściu, a nowa treść (nowa wersja) pokazuje
 * się od nowa wszystkim. Gdy schowek jest zamknięty (tryb prywatny, starsza
 * przeglądarka), okienko po prostu wyskoczy jeszcze raz — to lepsze niż
 * niepokazanie go wcale.
 *
 * Renderujemy dopiero po sprawdzeniu schowka, żeby stały czytelnik nie widział
 * mrugnięcia okienkiem, które zaraz znika.
 */
export function SerwisPopup({ locale }: { locale: Locale }) {
  const [widoczne, setWidoczne] = useState(false);
  const tekst = SERWIS.komunikat[locale];

  useEffect(() => {
    if (!serwisAktualny()) return;
    let juz = false;
    try {
      juz = window.localStorage.getItem(kluczSerwisu) === "1";
    } catch {
      // Schowek zamknięty — pokazujemy. Natrętność jest tu mniejszym złem.
    }
    if (!juz) setWidoczne(true);
  }, []);

  function zrozumiano() {
    try {
      window.localStorage.setItem(kluczSerwisu, "1");
    } catch {
      // Nie da się zapisać — wyskoczy następnym razem. Niech tak będzie.
    }
    setWidoczne(false);
  }

  if (!widoczne) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="serwis-tytul"
      className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4 backdrop-blur-[2px]"
    >
      <div className="w-full max-w-lg rounded-lg border border-rule border-t-2 border-t-accent2 bg-surface p-6 shadow-2xl">
        <div className="mb-3 flex items-center gap-2">
          <span
            aria-hidden="true"
            className="grid h-6 w-6 place-items-center rounded-full border border-accent2/60 font-mono text-sm text-accent2"
          >
            !
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent2">{tekst.etykieta}</span>
        </div>

        <h2 id="serwis-tytul" className="mb-2 font-display text-2xl font-bold">
          {tekst.tytul}
        </h2>
        <p className="mb-5 text-sm text-text2">{tekst.tresc}</p>

        <button
          type="button"
          autoFocus
          onClick={zrozumiano}
          className="btn btn-accent px-4 py-2"
        >
          {tekst.guzik}
        </button>
      </div>
    </div>
  );
}
