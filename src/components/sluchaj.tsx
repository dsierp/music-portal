"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Guzik „słuchaj" — rozwijany, z akcją domyślną zależną od podłączonych kont.
 *
 * Ten sam guzik widzi KAŻDY — zalogowany czy nie, z kontami czy bez. Dwie
 * osobne pigułki „Spotify" / „Tidal" zostały tylko dla utworów w podróży
 * (utworu nie da się puścić jako płyty). Akcja domyślna:
 * - Spotify podłączone → „Graj w Spotify": płyta rusza tam, gdzie człowiek ma
 *   otwarte Spotify (komputer, telefon, głośnik). Bez nowej karty.
 * - Tidal podłączony → „Otwórz w aplikacji Tidal": Tidal nie daje zewnętrznym
 *   aplikacjom sterowania odtwarzaniem, więc najbliżej „graj" jest otwarcie
 *   płyty prosto w ich aplikacji zamiast w przeglądarce.
 * - zawsze pierwsze jest to, czego człowiek użył ostatnio (pamiętamy
 *   w przeglądarce); za pierwszym razem „Graj w Spotify", gdy Spotify jest
 *   podłączone, a bez niego Spotify w przeglądarce.
 * „Graj w Tidalu" nie wymaga konta Tidala u nas — to tylko adres, który
 * otwiera ich aplikację na komputerze człowieka.
 *
 * W podróży (`przystanek`) wyjścia w przeglądarce idą przez /go/stop,
 * a granie i aplikacja wysyłają listę do /api/sluchaj — w obu przypadkach
 * przystanek dostaje ptaszek „znam to".
 * Pod strzałką zawsze reszta: druga aplikacja i oba serwisy w przeglądarce.
 *
 * Stan kont pobieramy RAZ na stronę (wspólna obietnica niżej): na premierach
 * guzików jest kilkadziesiąt, a odpowiedź dla wszystkich jest ta sama.
 */

type Teksty = {
  playSpotify: string;
  openTidalApp: string;
  spotifyWeb: string;
  tidalWeb: string;
  playMore: string;
  playingOn: string;
  playNoDevice: string;
  playNeedsConsent: string;
  playPremium: string;
  playFailed: string;
  tidalNotFound: string;
};
type Konta = { zalogowany: boolean; spotify: boolean; tidal: boolean; teksty: Teksty };

let kontaObietnica: Promise<Konta | null> | null = null;
function pobierzKonta(): Promise<Konta | null> {
  kontaObietnica ??= fetch("/api/sluchaj", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<Konta>) : null))
    .catch(() => null);
  return kontaObietnica;
}

type Opcja = "graj-spotify" | "app-tidal" | "web-spotify" | "web-tidal";
const PAMIEC = "pns:sluchaj";

function czytajPamiec(): Opcja | null {
  try {
    return (window.localStorage.getItem(PAMIEC) as Opcja | null) ?? null;
  } catch {
    return null;
  }
}
function zapiszPamiec(o: Opcja) {
  try {
    window.localStorage.setItem(PAMIEC, o);
  } catch {
    /* tryb prywatny — trudno, domyślna wróci */
  }
}

const PILL = "rounded-full border px-3 py-1 font-mono transition-colors";
const BARWA = {
  spotify: "border-spotify/40 text-spotify hover:bg-spotify/10",
  tidal: "border-tidal/40 text-tidal hover:bg-tidal/10",
};
function znak(stan: boolean | undefined): string {
  return stan === true ? "▸" : stan === false ? "⌕" : "·";
}

export function Sluchaj({
  etykieta,
  mbid,
  typ = "release-group",
  przystanek,
  stanSpotify,
  stanTidal,
  tytulSpotify,
  tytulTidal,
  small = false,
  className = "",
}: {
  etykieta: string;
  mbid?: string | null;
  typ?: "release-group" | "artist" | "recording";
  /** pozycja podróży — wyjście stawia przy niej ptaszek */
  przystanek?: { listId: string; typ: "ALBUM" | "ARTIST" | "RECORDING" };
  stanSpotify?: boolean;
  stanTidal?: boolean;
  tytulSpotify?: string;
  tytulTidal?: string;
  small?: boolean;
  className?: string;
}) {
  const [konta, setKonta] = useState<Konta | null>(null);
  const [otwarte, setOtwarte] = useState(false);
  const [komunikat, setKomunikat] = useState<{ tekst: string; link?: { href: string; tekst: string } } | null>(null);
  const [pracuje, setPracuje] = useState(false);
  const [ostatnia, setOstatnia] = useState<Opcja | null>(null);
  const ramka = useRef<HTMLDivElement>(null);
  /**
   * Adres płyty w aplikacji Tidala, ustalony ZAWCZASU — przy najechaniu myszą.
   *
   * Przeglądarka otwiera aplikację (`tidal://…`) tylko wtedy, gdy dzieje się
   * to wprost w geście kliknięcia. Gdy najpierw pytaliśmy serwer (sekunda,
   * dwie), przeglądarka za pierwszym razem jeszcze pytała „otworzyć Tidala?",
   * a przy kolejnych po cichu nic nie robiła. Z adresem w ręku kliknięcie
   * otwiera aplikację od razu, bez czekania na nic.
   */
  const typApi = typ === "artist" ? "artist" : "release-group";
  const cialoPost = (serwis: "spotify" | "tidal", tryb: string) =>
    JSON.stringify({
      serwis,
      typ: typApi,
      mbid: mbid ?? "",
      etykieta,
      tryb,
      ...(przystanek ? { listId: przystanek.listId, typPrzystanku: przystanek.typ } : {}),
    });
  const tidalZawczasu = useRef<{ appUrl?: string; url?: string | null } | null>(null);
  const tidalWToku = useRef(false);
  function przygotujTidala() {
    if (tidalWToku.current || tidalZawczasu.current) return;
    tidalWToku.current = true;
    fetch("/api/sluchaj", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: cialoPost("tidal", "adres"),
    })
      .then((r) => r.json())
      .then((w: { ok?: boolean; appUrl?: string; url?: string | null }) => {
        tidalZawczasu.current = { appUrl: w.ok ? w.appUrl : undefined, url: w.url };
      })
      .catch(() => {})
      .finally(() => {
        tidalWToku.current = false;
      });
  }

  useEffect(() => {
    let zyje = true;
    pobierzKonta().then((k) => zyje && setKonta(k));
    setOstatnia(czytajPamiec());
    return () => {
      zyje = false;
    };
  }, []);

  // Menu zamyka się kliknięciem gdziekolwiek obok i klawiszem Escape.
  useEffect(() => {
    if (!otwarte) return;
    const obok = (e: MouseEvent) => {
      if (ramka.current && !ramka.current.contains(e.target as Node)) setOtwarte(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOtwarte(false);
    document.addEventListener("mousedown", obok);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", obok);
      document.removeEventListener("keydown", esc);
    };
  }, [otwarte]);

  // Komunikat gaśnie sam — to informacja, nie okno do zamykania.
  useEffect(() => {
    if (!komunikat) return;
    const id = setTimeout(() => setKomunikat(null), 8000);
    return () => clearTimeout(id);
  }, [komunikat]);

  const adresWyjscia = (serwis: "spotify" | "tidal") =>
    przystanek
      ? `/go/stop?listId=${encodeURIComponent(przystanek.listId)}&type=${przystanek.typ}&mbid=${encodeURIComponent(mbid ?? "")}&serwis=${serwis}&etykieta=${encodeURIComponent(etykieta)}`
      : `/go/serwis?serwis=${serwis}&typ=${typApi}&mbid=${encodeURIComponent(mbid ?? "")}&etykieta=${encodeURIComponent(etykieta)}`;

  const zwykleGuziki = (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {(["spotify", "tidal"] as const).map((s) => {
        const stan = s === "spotify" ? stanSpotify : stanTidal;
        return (
          <a
            key={s}
            href={adresWyjscia(s)}
            target="_blank"
            rel="noopener"
            title={s === "spotify" ? tytulSpotify : tytulTidal}
            className={`${PILL} ${BARWA[s]} ${small ? "text-[11px]" : "text-xs"}`}
          >
            {znak(stan)} {s === "spotify" ? "Spotify" : "Tidal"}
          </a>
        );
      })}
    </div>
  );

  // Utwór: grać umiemy tylko płyty, więc zostają dwa zwykłe wyjścia.
  if (typ === "recording") return zwykleGuziki;

  /**
   * Zanim przyjdzie odpowiedź o kontach (ułamek sekundy, raz na stronę) —
   * ten sam kształt guzika, tylko jeszcze nieczynny. Wcześniej w tym czasie
   * stały stare pigułki i strona „przeskakiwała".
   */
  if (!konta) {
    const r = small ? "text-[11px]" : "text-xs";
    const b = BARWA[ostatnia?.endsWith("tidal") ? "tidal" : "spotify"];
    return (
      <div className={`inline-flex opacity-60 ${className}`} aria-busy="true">
        <span className={`rounded-l-full border px-3 py-1 font-mono ${b} ${r}`}>▶ {ostatnia?.endsWith("tidal") ? "Tidal" : "Spotify"}</span>
        <span className={`rounded-r-full border border-l-0 px-2 py-1 font-mono ${b} ${r}`}>▾</span>
      </div>
    );
  }
  const t = konta.teksty;

  const opcje: Opcja[] = [
    ...(konta.spotify ? (["graj-spotify"] as const) : []),
    "app-tidal",
    "web-spotify",
    "web-tidal",
  ];
  const domyslna: Opcja =
    ostatnia && opcje.includes(ostatnia) ? ostatnia : konta.spotify ? "graj-spotify" : "web-spotify";

  const nazwa: Record<Opcja, string> = {
    "graj-spotify": `▶ ${t.playSpotify}`,
    "app-tidal": `▶ ${t.openTidalApp}`,
    "web-spotify": `↗ ${t.spotifyWeb}`,
    "web-tidal": `↗ ${t.tidalWeb}`,
  };
  const serwisOpcji = (o: Opcja) => (o.endsWith("spotify") ? "spotify" : "tidal");

  async function wykonaj(o: Opcja) {
    setOtwarte(false);
    zapiszPamiec(o);
    setOstatnia(o);

    // Przeglądarka: zwykłe wyjście w nowej karcie — musi paść od razu w geście
    // kliknięcia, inaczej blokada wyskakujących okien je zatrzyma.
    if (o === "web-spotify" || o === "web-tidal") {
      window.open(adresWyjscia(serwisOpcji(o)), "_blank", "noopener");
      return;
    }

    // Tidal z adresem ustalonym zawczasu: otwieramy aplikację w tym samym
    // geście kliknięcia, a ślad w dzienniku wysyłamy obok, bez czekania.
    if (o === "app-tidal" && tidalZawczasu.current?.appUrl) {
      window.location.href = tidalZawczasu.current.appUrl;
      const cialo = cialoPost("tidal", "zapisz");
      try {
        navigator.sendBeacon("/api/sluchaj", new Blob([cialo], { type: "application/json" }));
      } catch {
        /* dziennik to dodatek */
      }
      return;
    }

    setPracuje(true);
    try {
      const res = await fetch("/api/sluchaj", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: cialoPost(serwisOpcji(o), o === "graj-spotify" ? "graj" : "aplikacja"),
      });
      const w = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        urzadzenie?: string | null;
        powod?: string;
        url?: string | null;
        appUrl?: string;
      };

      if (o === "app-tidal") {
        if (w.ok && w.appUrl) {
          // Otwieramy aplikację; gdyby przeglądarka uznała, że gest kliknięcia
          // już minął, zostaje link do kliknięcia w komunikacie.
          window.location.href = w.appUrl;
          setKomunikat({ tekst: "", link: { href: w.appUrl, tekst: t.openTidalApp } });
        } else {
          // Płyty nie ma w katalogu Tidala (albo nie umiemy jej dopasować) —
          // mówimy to wprost i dajemy wyszukiwarkę Tidala, zamiast milczeć.
          setKomunikat({ tekst: t.tidalNotFound, link: w.url ? { href: w.url, tekst: t.tidalWeb } : undefined });
        }
        return;
      }

      if (w.ok) {
        setKomunikat({ tekst: w.urzadzenie ? t.playingOn.replace("{urzadzenie}", w.urzadzenie) : "▶" });
        return;
      }
      const link = w.url ? { href: w.url, tekst: t.spotifyWeb } : undefined;
      const tekst =
        w.powod === "brak-urzadzenia"
          ? t.playNoDevice
          : w.powod === "brak-zgody"
            ? t.playNeedsConsent
            : w.powod === "premium"
              ? t.playPremium
              : t.playFailed;
      setKomunikat({ tekst, link });
    } catch {
      setKomunikat({ tekst: t.playFailed, link: { href: adresWyjscia("spotify"), tekst: t.spotifyWeb } });
    } finally {
      setPracuje(false);
    }
  }

  const rozmiar = small ? "text-[11px]" : "text-xs";
  const barwa = BARWA[serwisOpcji(domyslna)];

  return (
    <div ref={ramka} className={`relative inline-flex flex-col items-start gap-1 ${className}`}>
      <div className="inline-flex">
        <button
          type="button"
          onClick={() => wykonaj(domyslna)}
          onPointerEnter={() => domyslna === "app-tidal" && przygotujTidala()}
          onFocus={() => domyslna === "app-tidal" && przygotujTidala()}
          disabled={pracuje}
          className={`rounded-l-full border px-3 py-1 font-mono transition-colors ${barwa} ${rozmiar} ${pracuje ? "opacity-60" : ""}`}
        >
          {nazwa[domyslna]}
        </button>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={otwarte}
          aria-label={t.playMore}
          title={t.playMore}
          onClick={() => {
            // Menu się otwiera — Tidal może zaraz zostać wybrany, więc
            // ustalamy jego adres, zanim ręka dojedzie do pozycji.
            przygotujTidala();
            setOtwarte((x) => !x);
          }}
          className={`rounded-r-full border border-l-0 px-2 py-1 font-mono transition-colors ${barwa} ${rozmiar}`}
        >
          ▾
        </button>
      </div>

      {otwarte && (
        <div role="menu" className="absolute left-0 top-full z-30 mt-1 min-w-[14rem] rounded-md border border-rule bg-surface py-1 shadow-xl">
          {opcje
            .filter((o) => o !== domyslna)
            .map((o) => (
              <button
                key={o}
                type="button"
                role="menuitem"
                onClick={() => wykonaj(o)}
                className={`block w-full px-3 py-1.5 text-left font-mono ${rozmiar} ${serwisOpcji(o) === "spotify" ? "text-spotify" : "text-tidal"} hover:bg-surface2`}
              >
                {nazwa[o]}
              </button>
            ))}
        </div>
      )}

      {komunikat && (
        <span role="status" className="max-w-[22rem] font-mono text-[11px] leading-snug text-text2">
          {komunikat.tekst}
          {komunikat.link && (
            <>
              {komunikat.tekst ? " " : ""}
              <a href={komunikat.link.href} target={komunikat.link.href.startsWith("http") ? "_blank" : undefined} rel="noopener" className="underline">
                {komunikat.link.tekst}
              </a>
            </>
          )}
        </span>
      )}
    </div>
  );
}
