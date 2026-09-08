/**
 * Napisy ekranu: artist. Polski jest źródłem prawdy — z niego bierzemy typ.
 *
 * `timeline` to etykiety dla `LineupTimeline`/`CareerTimeline` — komponent nie
 * woła i18n() sam (rysuje SVG i chętnie idzie w wiele wierszy), więc strona
 * artysty podaje mu je propsami, w jednym obiekcie.
 */
import type { Locale } from "@/lib/i18n";

const pl = {
  mbUnavailableWhat: "artysty",
  personType: "muzyk",
  aka: "aka",
  favoriteActive: "★ Ulubiony",
  favoriteAdd: "☆ Do ulubionych",
  favoritesCount: "{n} w ulubionych",

  bandsHeading: "Zespoły",
  lineupHeading: "Skład",
  playedInBands: "Grał w zespołach",
  currently: "Obecnie",
  formerly: "Dawniej",
  guestOf: "Grał u (koncertowo / sesyjnie)",
  supportMusicians: "Muzycy towarzyszący",
  ownBandHeading: "Jego skład — kto z nim grał",
  ownBandNote: "Artysta solowy to też zespół: pod własnym nazwiskiem nagrywa z konkretnymi ludźmi. Poniżej ci, których MusicBrainz przypisał do jego płyt i tras.",
  albumsWithMember: "płyty z {name} ({n})",

  playedOnHeading: "Grał(a) na płytach",
  playedOnNote: "Wg składów w MusicBrainz — najpierw gościnnie i sesyjnie, potem z własnymi zespołami.",
  withBand: "z {name}",
  guestBadge: "gościnnie",

  albumsHeading: "Albumy",
  epHeading: "EP",
  otherReleases: "Pozostałe wydawnictwa — single, live, kompilacje, dema ({n})",
  noReleases: "MusicBrainz nie ma wydawnictw dla tego artysty.",

  creditsHeading: "Produkcja, realizacja, okładki",
  creditsNote: "Praca przy płytach, która nie jest graniem — w MusicBrainz wisi przy wydaniu, nie przy utworze. Stąd też da się ruszyć w podróż.",
  creditsMoreNote: "Pokazujemy 60 najnowszych z {n}.",

  relatedHeading: "Powiązane zespoły",
  relatedNote: "Liczone z MusicBrainz: przede wszystkim wspólni muzycy, pomocniczo wspólne gatunki. Bez zgadywania — przy każdym zespole widać, co go łączy.",
  relatedShared: "wspólne: {genres}",
  relatedLoading: "Szukam powiązanych zespołów…",

  deepLoading: "Wczytuję dyskografię i skład — przy artystach z długim dorobkiem chwilę to trwa…",

  timeline: {
    roleVocal: "wokal",
    inferredNote: "daty z płyt — MusicBrainz nie ma dat członkostwa",
    legendInferred: "okres odczytany z płyt, nie z dat członkostwa",
    roleGuitar: "gitara",
    roleBass: "bas",
    roleDrums: "perkusja",
    roleKeys: "klawisze",
    roleOther: "inne",
    axisAriaLabel: "Oś czasu",
    lineupSummary: { one: "Oś czasu składu ({n} osoba)", few: "Oś czasu składu ({n} osoby)", many: "Oś czasu składu ({n} osób)" } as { one: string; few?: string; many: string },
    careerSummary: { one: "Oś czasu: gdzie grał(a) {name} ({n} zespół)", few: "Oś czasu: gdzie grał(a) {name} ({n} zespoły)", many: "Oś czasu: gdzie grał(a) {name} ({n} zespołów)" } as { one: string; few?: string; many: string },
    markAlbumLabel: "album — najedź po tytuł, kliknij po stronę płyty",
    markOwnLabel: "płyta pod własnym nazwiskiem",
    legendInSpan: "płyta z jego okresu — kliknij po stronę płyty",
    legendOutSpan: "płyta zespołu spoza jego kadencji",
    footnote: "Z dat członkostwa w MusicBrainz. Brakujące daty rysujemy do dziś — MB nie zawsze ma komplet. Przerwa w pasku to odejście i powrót.",
    today: "dziś",
    outOfSpanSuffix: " — poza jego okresem w składzie",
  },
};
type T = typeof pl;

const en: T = {
  mbUnavailableWhat: "an artist",
  personType: "musician",
  aka: "aka",
  favoriteActive: "★ Favourite",
  favoriteAdd: "☆ Add to favourites",
  favoritesCount: "{n} have it in favourites",

  bandsHeading: "Bands",
  lineupHeading: "Lineup",
  playedInBands: "Played in bands",
  currently: "Currently",
  formerly: "Formerly",
  guestOf: "Played with (live / session)",
  supportMusicians: "Touring musicians",
  ownBandHeading: "Their band — who played with them",
  ownBandNote: "A solo artist is a band too: records under their own name are made with particular people. Below are the ones MusicBrainz ties to their albums and tours.",
  albumsWithMember: "albums with {name} ({n})",

  playedOnHeading: "Played on",
  playedOnNote: "By lineup data from MusicBrainz — guest and session credits first, then their own bands.",
  withBand: "with {name}",
  guestBadge: "guest",

  albumsHeading: "Albums",
  epHeading: "EP",
  otherReleases: "Other releases — singles, live albums, compilations, demos ({n})",
  noReleases: "MusicBrainz has no releases for this artist.",

  creditsHeading: "Production, engineering, artwork",
  creditsNote: "Work on records that isn't playing an instrument — MusicBrainz files it against the release, not the recording, so it opens up a trail of its own.",
  creditsMoreNote: "Showing the 60 most recent of {n}.",

  relatedHeading: "Related bands",
  relatedNote: "Worked out from MusicBrainz: shared musicians count most, shared genres are a tiebreaker. No guessing — each band shows exactly what connects it.",
  relatedShared: "shared: {genres}",
  relatedLoading: "Looking for related bands…",

  deepLoading: "Loading the discography and lineup — this can take a moment for artists with a long history…",

  timeline: {
    roleVocal: "vocals",
    inferredNote: "dates taken from the albums — MusicBrainz has no membership dates",
    legendInferred: "period read from the albums, not from membership dates",
    roleGuitar: "guitar",
    roleBass: "bass",
    roleDrums: "drums",
    roleKeys: "keys",
    roleOther: "other",
    axisAriaLabel: "Timeline",
    lineupSummary: { one: "Lineup timeline ({n} person)", many: "Lineup timeline ({n} people)" },
    careerSummary: { one: "Timeline: where {name} played ({n} band)", many: "Timeline: where {name} played ({n} bands)" },
    markAlbumLabel: "album — hover for the title, click through to the album",
    markOwnLabel: "album under their own name",
    legendInSpan: "album from their time in the band — click through to it",
    legendOutSpan: "album from outside their time in the band",
    footnote: "From membership dates on MusicBrainz. Missing dates are drawn through to today — MusicBrainz doesn't always have the full record. A gap in a bar means they left and came back.",
    today: "today",
    outOfSpanSuffix: " — outside their time in the lineup",
  },
};

const es: T = {
  mbUnavailableWhat: "un artista",
  personType: "músico",
  aka: "alias",
  favoriteActive: "★ Favorito",
  favoriteAdd: "☆ Añadir a favoritos",
  favoritesCount: "{n} lo tienen en favoritos",

  bandsHeading: "Bandas",
  lineupHeading: "Formación",
  playedInBands: "Tocó en bandas",
  currently: "Actualmente",
  formerly: "Anteriormente",
  guestOf: "Tocó con (en directo / de sesión)",
  supportMusicians: "Músicos de gira",
  ownBandHeading: "Su banda — quién tocó con él",
  ownBandNote: "Un artista en solitario también es una banda: los discos a su nombre se graban con gente concreta. Abajo, quienes MusicBrainz asocia a sus discos y giras.",
  albumsWithMember: "discos con {name} ({n})",

  playedOnHeading: "Discos en los que tocó",
  playedOnNote: "Según las formaciones de MusicBrainz — primero colaboraciones y sesiones, luego sus propias bandas.",
  withBand: "con {name}",
  guestBadge: "invitado",

  albumsHeading: "Álbumes",
  epHeading: "EP",
  otherReleases: "Otros lanzamientos — sencillos, directos, recopilatorios, demos ({n})",
  noReleases: "MusicBrainz no tiene lanzamientos de este artista.",

  creditsHeading: "Producción, ingeniería, portadas",
  creditsNote: "Trabajo en discos que no es tocar un instrumento — MusicBrainz lo registra en el lanzamiento, no en la grabación, así que también abre su propio camino.",
  creditsMoreNote: "Mostrando los 60 más recientes de {n}.",

  relatedHeading: "Bandas relacionadas",
  relatedNote: "Calculado a partir de MusicBrainz: sobre todo músicos en común, y como criterio secundario, géneros compartidos. Sin adivinar — cada banda muestra exactamente qué la conecta.",
  relatedShared: "en común: {genres}",
  relatedLoading: "Buscando bandas relacionadas…",

  deepLoading: "Cargando discografía y formación — con artistas de trayectoria larga puede tardar un momento…",

  timeline: {
    roleVocal: "voz",
    inferredNote: "fechas tomadas de los discos — MusicBrainz no tiene fechas de pertenencia",
    legendInferred: "periodo deducido de los discos, no de las fechas de pertenencia",
    roleGuitar: "guitarra",
    roleBass: "bajo",
    roleDrums: "batería",
    roleKeys: "teclados",
    roleOther: "otros",
    axisAriaLabel: "Línea temporal",
    lineupSummary: { one: "Línea temporal de la formación ({n} persona)", many: "Línea temporal de la formación ({n} personas)" },
    careerSummary: { one: "Línea temporal: dónde tocó {name} ({n} banda)", many: "Línea temporal: dónde tocó {name} ({n} bandas)" },
    markAlbumLabel: "álbum — pasa el ratón para ver el título, haz clic para ir a él",
    markOwnLabel: "álbum a su propio nombre",
    legendInSpan: "álbum de su etapa en la banda — haz clic para ir a él",
    legendOutSpan: "álbum fuera de su etapa en la banda",
    footnote: "Según las fechas de pertenencia en MusicBrainz. Las fechas que faltan se dibujan hasta hoy — MusicBrainz no siempre tiene el dato completo. Un hueco en la barra significa que se fue y volvió.",
    today: "hoy",
    outOfSpanSuffix: " — fuera de su etapa en la formación",
  },
};

const de: T = {
  mbUnavailableWhat: "eines Künstlers",
  personType: "Musiker",
  aka: "auch bekannt als",
  favoriteActive: "★ Favorit",
  favoriteAdd: "☆ Zu Favoriten",
  favoritesCount: "{n} haben es in den Favoriten",

  bandsHeading: "Bands",
  lineupHeading: "Besetzung",
  playedInBands: "Spielte in Bands",
  currently: "Aktuell",
  formerly: "Früher",
  guestOf: "Spielte bei (live / als Session-Musiker)",
  supportMusicians: "Begleitmusiker",
  ownBandHeading: "Seine Band — wer mit ihm spielte",
  ownBandNote: "Ein Soloartist ist auch eine Band: Platten unter eigenem Namen entstehen mit konkreten Leuten. Unten die, die MusicBrainz seinen Alben und Touren zuordnet.",
  albumsWithMember: "Alben mit {name} ({n})",

  playedOnHeading: "Mitgewirkt auf",
  playedOnNote: "Nach Besetzungsdaten von MusicBrainz — zuerst Gast- und Session-Auftritte, dann die eigenen Bands.",
  withBand: "mit {name}",
  guestBadge: "Gast",

  albumsHeading: "Alben",
  epHeading: "EP",
  otherReleases: "Weitere Veröffentlichungen — Singles, Livealben, Kompilationen, Demos ({n})",
  noReleases: "MusicBrainz hat keine Veröffentlichungen für diesen Künstler.",

  creditsHeading: "Produktion, Technik, Artwork",
  creditsNote: "Arbeit an Alben, die kein Instrumentalspiel ist — MusicBrainz führt sie beim Release, nicht bei der Aufnahme, und eröffnet damit einen eigenen Pfad.",
  creditsMoreNote: "Die 60 neuesten von {n} werden angezeigt.",

  relatedHeading: "Verwandte Bands",
  relatedNote: "Aus MusicBrainz errechnet: vor allem gemeinsame Musiker, ergänzend gemeinsame Genres. Ohne Raten — bei jeder Band ist zu sehen, was sie verbindet.",
  relatedShared: "gemeinsam: {genres}",
  relatedLoading: "Suche verwandte Bands…",

  deepLoading: "Lade Diskografie und Besetzung — bei Künstlern mit langer Geschichte dauert das einen Moment…",

  timeline: {
    roleVocal: "Gesang",
    inferredNote: "Daten aus den Alben — MusicBrainz hat keine Mitgliedsdaten",
    legendInferred: "Zeitraum aus den Alben abgelesen, nicht aus Mitgliedsdaten",
    roleGuitar: "Gitarre",
    roleBass: "Bass",
    roleDrums: "Schlagzeug",
    roleKeys: "Keyboard",
    roleOther: "sonstige",
    axisAriaLabel: "Zeitleiste",
    lineupSummary: { one: "Besetzungs-Zeitleiste ({n} Person)", many: "Besetzungs-Zeitleiste ({n} Personen)" },
    careerSummary: { one: "Zeitleiste: wo {name} spielte ({n} Band)", many: "Zeitleiste: wo {name} spielte ({n} Bands)" },
    markAlbumLabel: "Album — Titel per Hover ansehen, Klick führt zum Album",
    markOwnLabel: "Album unter eigenem Namen",
    legendInSpan: "Album aus seiner/ihrer Zeit in der Band — Klick führt dorthin",
    legendOutSpan: "Album außerhalb seiner/ihrer Zeit in der Band",
    footnote: "Nach Mitgliedschaftsdaten von MusicBrainz. Fehlende Daten werden bis heute gezeichnet — MusicBrainz hat nicht immer alles. Eine Lücke im Balken bedeutet Ausstieg und Rückkehr.",
    today: "heute",
    outOfSpanSuffix: " — außerhalb der Zeit in der Besetzung",
  },
};

export const artist: Record<Locale, T> = { pl, en, es, de };
