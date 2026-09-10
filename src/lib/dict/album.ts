/** Napisy ekranu: album. Polski jest źródłem prawdy — z niego bierzemy typ. */
import type { Locale } from "@/lib/i18n";

const pl = {
  dislikeAdd: "Nie moja bajka",
  dislikeActive: "Nie moja bajka ✓",
  dislikeArtistAsk: "Zapisane. A {name} w ogóle — też nie Twój klimat?",
  dislikeArtistYes: "Też nie",
  dislikeArtistNo: "nie, tylko ta płyta",
  mbUnavailableWhat: "płyty",
  noCoverLabel: "brak okładki",
  fullSizeCover: "okładka w pełnym rozmiarze ↗",
  releasedOn: "wydano {date}",
  coverLabel: "Okładka",

  likeActive: "♥ Lubisz",
  likeAdd: "♡ Lubię tę płytę",
  likesCount: { one: "{n} osoba lubi", few: "{n} osoby lubią", many: "{n} osób lubi" } as { one: string; few?: string; many: string },

  lineupHeading: "Muzycy",
  trackCountSuffix: "utw.",
  wikiCreditsPrefix: "Źródło:",
  wikiCreditsSuffix: " — MusicBrainz nie ma jeszcze tego składu na poziomie nagrań. Nazwiska rozpoznane w MusicBrainz prowadzą do profilu; pozostałe (kropkowane) do wyszukiwarki portalu.",
  searchInPortalTitle: "Szukaj w portalu",
  noLineupPrefix: "MusicBrainz nie ma jeszcze składu tej płyty. Zajrzyj do zespołu",
  noLineupMembers: "(członkowie) albo",

  currentLineupHeading: "Zespół w tym czasie",
  currentLineupNote: "Z dat członkostwa w MusicBrainz — kto był w składzie, gdy płyta wychodziła. To nie są credits z okładki: MusicBrainz opisuje nagrania wybiórczo, więc lista wyżej bywa krótsza niż rzeczywisty skład.",

  staffSummary: "Pozostałe osoby ({n})",

  tracksHeading: "Utwory",
  discLabel: "Dysk {n}",

  morePrefix: "Więcej:",

  mbLinkFooterSuffix: "brakuje składu? Uzupełnij go tam — portal zaciągnie zmiany w ciągu tygodnia.",

  // --- Pasek ocen (ratings-bar.tsx) ---
  mbVotes: { one: "{n} głos", few: "{n} głosy", many: "{n} głosów" } as { one: string; few?: string; many: string },
  pressNote: "prasa",
  noRatingsFound: "Nie znaleźliśmy ocen dla tej płyty — ani w MusicBrainz, ani w infoboksie na Wikipedii.",
  checkOnRym: "Sprawdź na RateYourMusic",
  pressSourceNote: "Oceny prasowe: infobox Wikipedii.",
};
type T = typeof pl;

const en: T = {
  dislikeAdd: "Not my thing",
  dislikeActive: "Not my thing ✓",
  dislikeArtistAsk: "Noted. And {name} in general — also not your thing?",
  dislikeArtistYes: "Them too",
  dislikeArtistNo: "no, just this album",
  mbUnavailableWhat: "an album",
  noCoverLabel: "no cover art",
  fullSizeCover: "full-size cover ↗",
  releasedOn: "released {date}",
  coverLabel: "Cover art",

  likeActive: "♥ You like this",
  likeAdd: "♡ Like this album",
  likesCount: { one: "{n} person likes this", many: "{n} people like this" },

  lineupHeading: "Musicians",
  trackCountSuffix: "trk.",
  wikiCreditsPrefix: "Source:",
  wikiCreditsSuffix: " — MusicBrainz doesn't have this lineup at the recording level yet. Names MusicBrainz recognises link to their profile; the rest (dotted underline) link to the portal search.",
  searchInPortalTitle: "Search the portal",
  noLineupPrefix: "MusicBrainz doesn't have a lineup for this album yet. Check the band",
  noLineupMembers: "(members) or",

  currentLineupHeading: "Band at the time",
  currentLineupNote: "From membership dates on MusicBrainz — who was in the lineup when this album came out. These aren't sleeve credits: MusicBrainz's recording data is selective, so this list can be shorter than the actual lineup.",

  staffSummary: "Everyone else ({n})",

  tracksHeading: "Tracklist",
  discLabel: "Disc {n}",

  morePrefix: "More from:",

  mbLinkFooterSuffix: "missing a lineup? Add it there — the portal picks up changes within a week.",

  mbVotes: { one: "{n} vote", many: "{n} votes" },
  pressNote: "press",
  noRatingsFound: "We couldn't find any ratings for this album — not on MusicBrainz, not in Wikipedia's infobox.",
  checkOnRym: "Check RateYourMusic",
  pressSourceNote: "Press ratings: Wikipedia infobox.",
};

const es: T = {
  dislikeAdd: "No es lo mío",
  dislikeActive: "No es lo mío ✓",
  dislikeArtistAsk: "Anotado. ¿Y {name} en general — tampoco es lo tuyo?",
  dislikeArtistYes: "Tampoco",
  dislikeArtistNo: "no, solo este disco",
  mbUnavailableWhat: "un disco",
  noCoverLabel: "sin portada",
  fullSizeCover: "portada a tamaño completo ↗",
  releasedOn: "publicado el {date}",
  coverLabel: "Portada",

  likeActive: "♥ Te gusta",
  likeAdd: "♡ Me gusta este disco",
  likesCount: { one: "{n} persona le da me gusta", many: "{n} personas le dan me gusta" },

  lineupHeading: "Músicos",
  trackCountSuffix: "pistas",
  wikiCreditsPrefix: "Fuente:",
  wikiCreditsSuffix: " — MusicBrainz todavía no tiene esta formación a nivel de grabación. Los nombres que MusicBrainz reconoce enlazan a su perfil; el resto (subrayado punteado) enlaza al buscador del portal.",
  searchInPortalTitle: "Buscar en el portal",
  noLineupPrefix: "MusicBrainz todavía no tiene la formación de este disco. Échale un vistazo a la banda",
  noLineupMembers: "(miembros) o a",

  currentLineupHeading: "La banda en ese momento",
  currentLineupNote: "Según las fechas de pertenencia en MusicBrainz — quién estaba en la formación cuando salió este disco. No son créditos de la portada: MusicBrainz describe las grabaciones de forma selectiva, así que esta lista puede ser más corta que la formación real.",

  staffSummary: "Las demás personas ({n})",

  tracksHeading: "Canciones",
  discLabel: "Disco {n}",

  morePrefix: "Más de:",

  mbLinkFooterSuffix: "¿falta la formación? Añádela allí — el portal recoge los cambios en una semana.",

  mbVotes: { one: "{n} voto", many: "{n} votos" },
  pressNote: "prensa",
  noRatingsFound: "No hemos encontrado valoraciones para este disco — ni en MusicBrainz ni en la ficha de Wikipedia.",
  checkOnRym: "Consulta RateYourMusic",
  pressSourceNote: "Valoraciones de prensa: ficha de Wikipedia.",
};

const de: T = {
  dislikeAdd: "Nicht mein Ding",
  dislikeActive: "Nicht mein Ding ✓",
  dislikeArtistAsk: "Notiert. Und {name} überhaupt — auch nicht dein Ding?",
  dislikeArtistYes: "Auch nicht",
  dislikeArtistNo: "nein, nur dieses Album",
  mbUnavailableWhat: "eines Albums",
  noCoverLabel: "kein Cover",
  fullSizeCover: "Cover in voller Größe ↗",
  releasedOn: "veröffentlicht am {date}",
  coverLabel: "Cover",

  likeActive: "♥ Gefällt dir",
  likeAdd: "♡ Album gefällt mir",
  likesCount: { one: "{n} Person gefällt das", many: "{n} Personen gefällt das" },

  lineupHeading: "Musiker",
  trackCountSuffix: "Titel",
  wikiCreditsPrefix: "Quelle:",
  wikiCreditsSuffix: " — MusicBrainz hat diese Besetzung auf Aufnahmeebene noch nicht erfasst. Namen, die MusicBrainz kennt, führen zum Profil; die übrigen (gepunktet unterstrichen) zur Portalsuche.",
  searchInPortalTitle: "Im Portal suchen",
  noLineupPrefix: "MusicBrainz hat für dieses Album noch keine Besetzung. Sieh bei der Band",
  noLineupMembers: "(Mitglieder) oder bei",

  currentLineupHeading: "Die Band zu dieser Zeit",
  currentLineupNote: "Nach Mitgliedschaftsdaten von MusicBrainz — wer zur Besetzung gehörte, als dieses Album erschien. Das sind keine Album-Credits: MusicBrainz erfasst Aufnahmen selektiv, daher kann diese Liste kürzer sein als die tatsächliche Besetzung.",

  staffSummary: "Alle Übrigen ({n})",

  tracksHeading: "Titelliste",
  discLabel: "CD {n}",

  morePrefix: "Mehr von:",

  mbLinkFooterSuffix: "fehlt die Besetzung? Trag sie dort ein — das Portal übernimmt Änderungen innerhalb einer Woche.",

  mbVotes: { one: "{n} Stimme", many: "{n} Stimmen" },
  pressNote: "Presse",
  noRatingsFound: "Wir haben keine Bewertungen für dieses Album gefunden — weder bei MusicBrainz noch in der Wikipedia-Infobox.",
  checkOnRym: "Bei RateYourMusic nachsehen",
  pressSourceNote: "Pressebewertungen: Wikipedia-Infobox.",
};

export const album: Record<Locale, T> = { pl, en, es, de };
