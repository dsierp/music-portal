/**
 * Przewodnik po ekranach. Polski jest źródłem prawdy — z niego bierzemy typ.
 *
 * Powód: ludzie wchodzą i nie wiedzą, po co to jest. Portal wygląda jak jeszcze
 * jeden katalog płyt, a jest narzędziem do SZUKANIA i ODKRYWANIA — od płyty do
 * człowieka, od człowieka do jego innych zespołów. Tego się nie odgadnie
 * z układu strony, więc trzeba powiedzieć wprost, ekran po ekranie.
 *
 * Każdy ekran ma trzy–cztery kroki, każdy krok jedno zdanie. Dłuższych nikt nie
 * czyta, a instrukcja, której nikt nie czyta, jest warta tyle co jej brak.
 */
import type { Locale } from "@/lib/i18n";

interface Ekran {
  title: string;
  lead: string;
  steps: { h: string; p: string }[];
}

const pl = {
  open: "Jak tu się poruszać?",
  close: "zwiń",
  fullGuide: "cały przewodnik →",
  guideTitle: "Przewodnik",
  guideLead:
    "Tu się podróżuje pomiędzy twórcami. Szukasz płyty, klikasz w perkusistę ze składu i masz wszystkie zespoły, w których grał, oraz płyty, które nagrał — a stamtąd idziesz dalej. W Spotify dostajesz to, co algorytm uzna za podobne; tutaj sam ciągniesz za nitkę. Poniżej ekran po ekranie.",

  start: {
    title: "Strona główna",
    lead: "Punkt wyjścia: co nowego i co Twoje.",
    steps: [
      { h: "Premiery pod Ciebie", p: "Piątkowe nowości zawężone do gatunków, które wybrałeś w profilu." },
      { h: "Kto zmienił zespół", p: "Zmiany w składach zespołów, które oznaczyłeś gwiazdką. Bez ulubionych ta sekcja nie ma czego pokazać — gwiazdkę stawia się na stronie zespołu." },
      { h: "Dziennik i podróże", p: "Po prawej Twoje ślady i trasy przez muzykę, do których wracasz." },
    ],
  },
  szukaj: {
    title: "Szukanie",
    lead: "Stąd zaczyna się każde odkrycie. Szukaj tu, nie w serwisie streamingowym.",
    steps: [
      { h: "Wpisz cokolwiek", p: "Zespół, płytę albo nazwisko muzyka — nawet z literówką, portal spróbuje się domyślić." },
      { h: "Zawęź zakresem", p: "Chipsy nad wynikami pytają osobno o płyty, zespoły i ludzi — przy zawężeniu trafień jest więcej." },
      { h: "Nie kończ na wyniku", p: "Wejdź w płytę, potem w muzyka ze składu, potem w jego inne zespoły. Tu zaczyna się odkrywanie." },
    ],
  },
  premiery: {
    title: "Premiery",
    lead: "Co tydzień świeża lista, ułożona pod Twoje gatunki.",
    steps: [
      { h: "Odklikaj gatunki", p: "Chipsy zawężają listę; ★ zostawia tylko wyróżnione, a wznowienia i EP można ukryć." },
      { h: "Wejdź w płytę", p: "Ze strony płyty widzisz skład, producenta i linki do odsłuchu." },
      { h: "Zbierz to w podróż", p: "Przycisk pod tygodniem zamienia to, co widzisz, w jedną podróż do posłuchania." },
    ],
  },
  artysta: {
    title: "Strona zespołu albo muzyka",
    lead: "Najważniejszy ekran w portalu — stąd prowadzą wszystkie nitki.",
    steps: [
      { h: "Oś czasu składu", p: "Kto i kiedy grał. Przerywana kreska znaczy, że dat nie zna żadna baza — nie zgadujemy." },
      { h: "Grał na płytach", p: "U muzyka: czyje płyty nagrywał poza własnymi zespołami. Tędy trafia się najdalej." },
      { h: "Kto to nagrał", p: "Producenci i autorzy okładek. Każde nazwisko to kolejny przystanek — zobacz, przy czym jeszcze pracowali." },
      { h: "Powiązane zespoły", p: "Liczone ze wspólnych muzyków, nie z popularności. Dlatego prowadzą gdzieś dalej niż „podobni wykonawcy”." },
    ],
  },
  plyta: {
    title: "Strona płyty",
    lead: "Wszystko o jednym wydawnictwie i drogi dalej.",
    steps: [
      { h: "Posłuchaj", p: "Linki do Spotify i Tidala są na górze — portal nie odtwarza, tylko prowadzi." },
      { h: "Oceń albo odrzuć", p: "„Nie moja bajka” to nie ocena 1/10, tylko „nie mój klimat” — portal przestanie to podsuwać." },
      { h: "Zobacz, kto grał", p: "Skład i kredyty produkcyjne; każde nazwisko jest odnośnikiem." },
      { h: "Do podróży", p: "Odłóż na później albo dołóż do trasy, którą komuś polecisz." },
    ],
  },
  koncerty: {
    title: "Koncerty",
    lead: "Czy i gdzie grają — w miastach, które sam wskażesz.",
    steps: [
      { h: "Ustaw miasta", p: "Osobno dla ulubionych zespołów i osobno dla gatunków: po ulubionych jedzie się dalej." },
      { h: "Twoje gatunki na wierzchu", p: "Reszta zostaje widoczna, ale niżej — masz decydować sam." },
      { h: "Weź kogoś ze sobą", p: "Koncert też jest przystankiem: wrzuć go do podróży i poleć znajomemu." },
    ],
  },
  podroze: {
    title: "Podróże",
    lead: "Ułożona przez Ciebie trasa przez muzykę — do siebie albo dla kogoś.",
    steps: [
      { h: "Dokładaj przystanki", p: "Płyty, zespoły, muzycy i koncerty; kolejność jest treścią, więc układ ma znaczenie." },
      { h: "Odhaczaj po drodze", p: "Ptaszek stawia się sam, gdy ocenisz płytę albo wyjdziesz stąd do Spotify czy Tidala." },
      { h: "Poleć albo wyślij sobie", p: "Możesz podrzucić podróż komuś z portalu, a całość zapisać jako prywatną playlistę w Spotify." },
    ],
  },
} satisfies { open: string; close: string; fullGuide: string; guideTitle: string; guideLead: string } & Record<
  string,
  Ekran | string
>;
type T = typeof pl;

const en: T = {
  open: "How do I use this?",
  close: "hide",
  fullGuide: "full guide →",
  guideTitle: "Guide",
  guideLead:
    "This is a place to travel between the people who make music. You search for an album, click the drummer in the line-up, and get every band he played in and every record he made — and from there you keep going. Spotify gives you what an algorithm calls similar; here you pull the thread yourself. Screen by screen below.",

  start: {
    title: "Home",
    lead: "The starting point: what's new and what's yours.",
    steps: [
      { h: "Releases for you", p: "Friday's new albums narrowed to the genres you picked in your profile." },
      { h: "Who changed bands", p: "Line-up changes in the bands you starred. With no favourites this section has nothing to show — you star a band on its own page." },
      { h: "Journal and journeys", p: "On the right, your own tracks and the routes through music you keep coming back to." },
    ],
  },
  szukaj: {
    title: "Search",
    lead: "Every discovery starts here. Search here, not in a streaming service.",
    steps: [
      { h: "Type anything", p: "A band, an album or a musician's name — a typo is fine, the portal will try to work it out." },
      { h: "Narrow by scope", p: "The chips above the results ask separately about albums, bands and people — narrowing returns more hits." },
      { h: "Don't stop at the result", p: "Open the album, then a musician from the line-up, then their other bands. That's where discovery starts." },
    ],
  },
  premiery: {
    title: "New releases",
    lead: "A fresh list every week, ordered around your genres.",
    steps: [
      { h: "Untick genres", p: "The chips narrow the list; ★ keeps only the highlights, and reissues and EPs can be hidden." },
      { h: "Open an album", p: "From the album page you see the line-up, the producer and links to listen." },
      { h: "Turn it into a journey", p: "The button under a week turns exactly what you see into one journey to listen through." },
    ],
  },
  artysta: {
    title: "A band or musician page",
    lead: "The most important screen here — every thread leads from it.",
    steps: [
      { h: "Line-up timeline", p: "Who played when. A dashed bar means no database knows the dates — we don't guess." },
      { h: "Played on", p: "For a musician: whose records they played on beyond their own bands. This leads furthest." },
      { h: "Who recorded it", p: "Producers and cover artists. Every name is another stop — see what else they worked on." },
      { h: "Related bands", p: "Counted from shared musicians, not from popularity. That's why they lead somewhere further than “similar artists”." },
    ],
  },
  plyta: {
    title: "An album page",
    lead: "Everything about one release, and the ways onward.",
    steps: [
      { h: "Listen", p: "Spotify and Tidal links sit at the top — the portal doesn't play music, it points you to it." },
      { h: "Rate it, or pass", p: "“Not my thing” isn't a 1/10 — it means the style isn't yours, and the portal stops suggesting it." },
      { h: "See who played", p: "Line-up and production credits; every name is a link." },
      { h: "To a journey", p: "Save it for later or add it to a route you'll recommend to someone." },
    ],
  },
  koncerty: {
    title: "Concerts",
    lead: "Whether and where they play — in the cities you name.",
    steps: [
      { h: "Set your cities", p: "Separately for favourite bands and for genres: for a favourite you'll travel further." },
      { h: "Your genres first", p: "The rest stays visible, just lower — you decide, not us." },
      { h: "Take someone with you", p: "A concert is a stop too: put it in a journey and pass it to a friend." },
    ],
  },
  podroze: {
    title: "Journeys",
    lead: "A route through music you set yourself — for you or for someone else.",
    steps: [
      { h: "Add stops", p: "Albums, bands, musicians and concerts; the order is part of the content, so arrangement matters." },
      { h: "Tick them off on the way", p: "The tick appears by itself when you rate an album or leave from here to Spotify or Tidal." },
      { h: "Recommend it, or send it to yourself", p: "Pass a journey to someone in the portal, and save the whole thing as a private Spotify playlist." },
    ],
  },
};

const es: T = {
  open: "¿Cómo se usa esto?",
  close: "ocultar",
  fullGuide: "guía completa →",
  guideTitle: "Guía",
  guideLead:
    "Aquí se viaja entre las personas que hacen la música. Buscas un disco, pinchas en el batería de la formación y tienes todas las bandas en las que tocó y los discos que grabó; desde ahí sigues. Spotify te da lo que un algoritmo considera parecido; aquí tiras del hilo tú. Pantalla por pantalla, abajo.",

  start: {
    title: "Inicio",
    lead: "El punto de partida: lo nuevo y lo tuyo.",
    steps: [
      { h: "Novedades para ti", p: "Los estrenos del viernes acotados a los géneros que elegiste en tu perfil." },
      { h: "Quién cambió de banda", p: "Cambios de formación en las bandas que marcaste con estrella. Sin favoritos esta sección no tiene nada que mostrar — la estrella se pone en la página de la banda." },
      { h: "Diario y viajes", p: "A la derecha, tus huellas y las rutas por la música a las que vuelves." },
    ],
  },
  szukaj: {
    title: "Búsqueda",
    lead: "Todo descubrimiento empieza aquí. Busca aquí, no en un servicio de streaming.",
    steps: [
      { h: "Escribe lo que sea", p: "Una banda, un disco o el nombre de un músico; una errata no importa, el portal intentará adivinar." },
      { h: "Acota por ámbito", p: "Las pastillas sobre los resultados preguntan por separado por discos, bandas y personas: al acotar salen más." },
      { h: "No te quedes en el resultado", p: "Abre el disco, luego un músico de la formación, luego sus otras bandas. Ahí empieza descubrir." },
    ],
  },
  premiery: {
    title: "Novedades",
    lead: "Una lista fresca cada semana, ordenada según tus géneros.",
    steps: [
      { h: "Desmarca géneros", p: "Las pastillas acotan la lista; ★ deja solo lo destacado, y puedes ocultar reediciones y EP." },
      { h: "Abre un disco", p: "Desde la página del disco ves la formación, el productor y los enlaces para escuchar." },
      { h: "Conviértelo en viaje", p: "El botón bajo la semana convierte justo lo que ves en un viaje para escuchar." },
    ],
  },
  artysta: {
    title: "Página de banda o músico",
    lead: "La pantalla más importante: de aquí salen todos los hilos.",
    steps: [
      { h: "Línea de tiempo", p: "Quién tocó y cuándo. Una barra discontinua significa que ninguna base sabe las fechas: no adivinamos." },
      { h: "Tocó en", p: "En un músico: en qué discos ajenos tocó, más allá de sus bandas. Por aquí se llega más lejos." },
      { h: "Quién lo grabó", p: "Productores y autores de portada. Cada nombre es otra parada: mira en qué más trabajaron." },
      { h: "Bandas relacionadas", p: "Calculadas por músicos compartidos, no por popularidad. Por eso llevan más lejos que «artistas similares»." },
    ],
  },
  plyta: {
    title: "Página del disco",
    lead: "Todo sobre un lanzamiento y por dónde seguir.",
    steps: [
      { h: "Escucha", p: "Los enlaces a Spotify y Tidal están arriba: el portal no reproduce, te lleva." },
      { h: "Puntúa o descarta", p: "«No es lo mío» no es un 1/10: significa que el estilo no va contigo y el portal deja de proponerlo." },
      { h: "Mira quién tocó", p: "Formación y créditos de producción; cada nombre es un enlace." },
      { h: "A un viaje", p: "Guárdalo para después o añádelo a una ruta que vayas a recomendar." },
    ],
  },
  koncerty: {
    title: "Conciertos",
    lead: "Si tocan y dónde, en las ciudades que tú indiques.",
    steps: [
      { h: "Elige tus ciudades", p: "Por separado para bandas favoritas y para géneros: por una favorita se viaja más lejos." },
      { h: "Tus géneros primero", p: "El resto sigue visible, solo que más abajo: decides tú." },
      { h: "Llévate a alguien", p: "Un concierto también es una parada: mételo en un viaje y pásalo a un amigo." },
    ],
  },
  podroze: {
    title: "Viajes",
    lead: "Una ruta por la música armada por ti, para ti o para otra persona.",
    steps: [
      { h: "Añade paradas", p: "Discos, bandas, músicos y conciertos; el orden es parte del contenido, así que importa." },
      { h: "Ve marcándolas", p: "La marca aparece sola cuando puntúas un disco o sales de aquí a Spotify o Tidal." },
      { h: "Recomienda o envíatelo", p: "Pasa un viaje a alguien del portal y guarda el conjunto como lista privada en Spotify." },
    ],
  },
};

const de: T = {
  open: "Wie benutze ich das?",
  close: "einklappen",
  fullGuide: "ganzer Leitfaden →",
  guideTitle: "Leitfaden",
  guideLead:
    "Hier reist man zwischen den Menschen, die die Musik machen. Du suchst ein Album, klickst auf den Schlagzeuger der Besetzung und hast alle Bands, in denen er gespielt hat, und alle Platten, die er aufgenommen hat — und von dort geht es weiter. Spotify gibt dir, was ein Algorithmus für ähnlich hält; hier ziehst du selbst am Faden. Unten Bildschirm für Bildschirm.",

  start: {
    title: "Startseite",
    lead: "Der Ausgangspunkt: was neu ist und was deins ist.",
    steps: [
      { h: "Neuheiten für dich", p: "Die Freitagsveröffentlichungen, eingegrenzt auf die Genres aus deinem Profil." },
      { h: "Wer die Band gewechselt hat", p: "Besetzungswechsel in den Bands, die du mit einem Stern markiert hast. Ohne Favoriten hat dieser Abschnitt nichts zu zeigen — den Stern setzt man auf der Bandseite." },
      { h: "Tagebuch und Reisen", p: "Rechts deine Spuren und die Routen durch die Musik, zu denen du zurückkehrst." },
    ],
  },
  szukaj: {
    title: "Suche",
    lead: "Jede Entdeckung beginnt hier. Such hier, nicht im Streamingdienst.",
    steps: [
      { h: "Tipp irgendetwas ein", p: "Eine Band, ein Album oder einen Musikernamen — ein Tippfehler ist egal, das Portal versucht es zu erraten." },
      { h: "Grenze den Bereich ein", p: "Die Chips über den Treffern fragen getrennt nach Alben, Bands und Personen — eingegrenzt kommt mehr zurück." },
      { h: "Bleib nicht beim Treffer stehen", p: "Öffne das Album, dann einen Musiker aus der Besetzung, dann dessen andere Bands. Da beginnt das Entdecken." },
    ],
  },
  premiery: {
    title: "Neuerscheinungen",
    lead: "Jede Woche eine frische Liste, nach deinen Genres sortiert.",
    steps: [
      { h: "Genres abwählen", p: "Die Chips grenzen die Liste ein; ★ lässt nur die Hervorgehobenen, Wiederveröffentlichungen und EPs lassen sich ausblenden." },
      { h: "Ein Album öffnen", p: "Auf der Albumseite siehst du Besetzung, Produzent und Links zum Hören." },
      { h: "Daraus eine Reise machen", p: "Der Knopf unter einer Woche macht aus genau dem, was du siehst, eine Reise zum Durchhören." },
    ],
  },
  artysta: {
    title: "Band- oder Musikerseite",
    lead: "Der wichtigste Bildschirm hier — von ihm gehen alle Fäden aus.",
    steps: [
      { h: "Zeitleiste der Besetzung", p: "Wer wann gespielt hat. Ein gestrichelter Balken heißt: keine Datenbank kennt die Daten — wir raten nicht." },
      { h: "Mitgewirkt auf", p: "Bei einem Musiker: auf wessen Platten er außerhalb seiner Bands gespielt hat. Hier kommt man am weitesten." },
      { h: "Wer es aufgenommen hat", p: "Produzenten und Coverkünstler. Jeder Name ist ein weiterer Halt — sieh, woran sie sonst gearbeitet haben." },
      { h: "Verwandte Bands", p: "Aus gemeinsamen Musikern berechnet, nicht aus Popularität. Darum führen sie weiter als „ähnliche Künstler“." },
    ],
  },
  plyta: {
    title: "Albumseite",
    lead: "Alles zu einer Veröffentlichung und die Wege weiter.",
    steps: [
      { h: "Hören", p: "Die Links zu Spotify und Tidal stehen oben — das Portal spielt nichts ab, es führt hin." },
      { h: "Bewerten oder ablehnen", p: "„Nicht mein Ding“ ist keine 1/10 — es heißt, der Stil ist nicht deiner, und das Portal schlägt ihn nicht mehr vor." },
      { h: "Sieh, wer gespielt hat", p: "Besetzung und Produktionscredits; jeder Name ist ein Link." },
      { h: "Auf eine Reise", p: "Für später zurücklegen oder in eine Route packen, die du weitergibst." },
    ],
  },
  koncerty: {
    title: "Konzerte",
    lead: "Ob und wo sie spielen — in den Städten, die du angibst.",
    steps: [
      { h: "Städte festlegen", p: "Getrennt für Lieblingsbands und für Genres: für eine Lieblingsband fährt man weiter." },
      { h: "Deine Genres zuerst", p: "Der Rest bleibt sichtbar, nur weiter unten — du entscheidest." },
      { h: "Nimm jemanden mit", p: "Ein Konzert ist auch ein Halt: pack es in eine Reise und gib sie weiter." },
    ],
  },
  podroze: {
    title: "Reisen",
    lead: "Eine von dir gelegte Route durch die Musik — für dich oder für jemanden.",
    steps: [
      { h: "Halte hinzufügen", p: "Alben, Bands, Musiker und Konzerte; die Reihenfolge ist Inhalt, also zählt die Anordnung." },
      { h: "Unterwegs abhaken", p: "Der Haken setzt sich von selbst, wenn du ein Album bewertest oder von hier zu Spotify oder Tidal gehst." },
      { h: "Empfehlen oder sich selbst schicken", p: "Gib eine Reise an jemanden im Portal weiter und sichere das Ganze als private Spotify-Playlist." },
    ],
  },
};

export const help: Record<Locale, T> = { pl, en, es, de };
export type HelpScreen = Ekran;
