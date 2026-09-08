/**
 * Nagłówek, stopka i rzeczy wspólne dla całego portalu.
 *
 * Wzór dla wszystkich plików słownika: polski jest źródłem prawdy i z niego
 * bierzemy typ, więc brak klucza w innym języku wywala build, a nie stronę.
 */
import type { Locale } from "@/lib/i18n";

const pl = {
  releases: "Premiery",
  concerts: "Koncerty",
  bestOf: "Best of",
  lists: "Listy",
  logIn: "Zaloguj",
  logOut: "wyloguj",
  me: "Profil",
  search: "Szukaj",
  searchPlaceholder: "zespół, płyta, muzyk…",
  language: "Język",
  siteDescription: "Premiery, best of i podróż po płytach, zespołach i muzykach. Metal, prog, jazz.",
  footer: "Dane: MusicBrainz · Wikipedia · Cover Art Archive. Oceny i komentarze należą do użytkowników portalu.",
};
type T = typeof pl;

const en: T = {
  releases: "New releases",
  concerts: "Concerts",
  bestOf: "Best of",
  lists: "Lists",
  logIn: "Sign in",
  logOut: "sign out",
  me: "Profile",
  search: "Search",
  searchPlaceholder: "band, album, musician…",
  language: "Language",
  siteDescription: "New releases, best-of lists and a journey through albums, bands and musicians. Metal, prog, jazz.",
  footer: "Data: MusicBrainz · Wikipedia · Cover Art Archive. Ratings and comments belong to the people who wrote them.",
};

const es: T = {
  releases: "Novedades",
  concerts: "Conciertos",
  bestOf: "Lo mejor",
  lists: "Listas",
  logIn: "Iniciar sesión",
  logOut: "cerrar sesión",
  me: "Perfil",
  search: "Buscar",
  searchPlaceholder: "banda, disco, músico…",
  language: "Idioma",
  siteDescription: "Novedades, listas de lo mejor y un viaje por discos, bandas y músicos. Metal, prog, jazz.",
  footer: "Datos: MusicBrainz · Wikipedia · Cover Art Archive. Las valoraciones y los comentarios pertenecen a quienes los escriben.",
};

const de: T = {
  releases: "Neuerscheinungen",
  concerts: "Konzerte",
  bestOf: "Best of",
  lists: "Listen",
  logIn: "Anmelden",
  logOut: "abmelden",
  me: "Profil",
  search: "Suchen",
  searchPlaceholder: "Band, Album, Musiker…",
  language: "Sprache",
  siteDescription: "Neuerscheinungen, Best-of-Listen und eine Reise durch Alben, Bands und Musiker. Metal, Prog, Jazz.",
  footer: "Daten: MusicBrainz · Wikipedia · Cover Art Archive. Bewertungen und Kommentare gehören denen, die sie geschrieben haben.",
};

export const nav: Record<Locale, T> = { pl, en, es, de };
