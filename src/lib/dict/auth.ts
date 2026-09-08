/** Napisy ekranu: auth. Polski jest źródłem prawdy — z niego bierzemy typ. */
import type { Locale } from "@/lib/i18n";

const pl = {
  title: "Zaloguj się",
  intro: "Nie zakładasz konta — logujesz się kontem, które już masz. Zapamiętujemy Twój e-mail, preferencje, oceny i komentarze.",
  continueWith: "Kontynuuj z {provider}",
  noProviders: "Brak skonfigurowanych dostawców logowania — uzupełnij klucze w .env.",
  devTitle: "Logowanie deweloperskie (tylko lokalnie)",
  emailPlaceholder: "twoj@email",
  enter: "Wejdź",
};
type T = typeof pl;

const en: T = {
  title: "Sign in",
  intro: "You're not creating an account — you sign in with one you already have. We remember your email, preferences, ratings and comments.",
  continueWith: "Continue with {provider}",
  noProviders: "No sign-in providers configured — add the keys in .env.",
  devTitle: "Developer sign-in (local only)",
  emailPlaceholder: "you@email",
  enter: "Enter",
};

const es: T = {
  title: "Inicia sesión",
  intro: "No creas una cuenta nueva: inicias sesión con una que ya tienes. Recordamos tu correo, tus preferencias, valoraciones y comentarios.",
  continueWith: "Continuar con {provider}",
  noProviders: "No hay proveedores de acceso configurados — añade las claves en .env.",
  devTitle: "Acceso de desarrollo (solo en local)",
  emailPlaceholder: "tu@email",
  enter: "Entrar",
};

const de: T = {
  title: "Anmelden",
  intro: "Du legst kein neues Konto an — du meldest dich mit einem an, das du schon hast. Wir merken uns deine E-Mail, deine Einstellungen, Bewertungen und Kommentare.",
  continueWith: "Weiter mit {provider}",
  noProviders: "Keine Anmeldedienste eingerichtet — trage die Schlüssel in .env ein.",
  devTitle: "Entwickler-Anmeldung (nur lokal)",
  emailPlaceholder: "deine@email",
  enter: "Los",
};

export const auth: Record<Locale, T> = { pl, en, es, de };
