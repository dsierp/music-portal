/**
 * Napisy ekranu „O portalu". Polski jest źródłem prawdy — z niego bierzemy typ.
 *
 * Osobny ekran, a nie akapit w stopce, bo to jedyne miejsce, gdzie mówimy
 * wprost trzy rzeczy: po co ten portal jest, skąd bierze dane i czego NIE robi.
 * Ta trzecia jest najważniejsza — portal pokazuje dziury w bazach zamiast je
 * zamiatać, więc lepiej uprzedzić, niż pozwolić komuś myśleć, że coś się psuje.
 */
import type { Locale } from "@/lib/i18n";

const pl = {
  navHint: "O portalu",
  title: "Co to za portal",
  lead: "Pure New Shit to przewodnik po muzyce spoza głównego nurtu — metal, prog i jazz przede wszystkim, ale nie tylko. Nie sprzedaje muzyki i nie odtwarza jej: prowadzi do niej i pokazuje, co się z czym łączy.",

  whatTitle: "Co tu robisz",
  whatBody:
    "Przeglądasz piątkowe premiery ułożone pod Twoje gatunki, wchodzisz w płytę albo zespół i ciągniesz dalej: kto grał w składzie, w czym jeszcze gra, kto to wyprodukował i co jeszcze wyprodukował. Oceniasz, komentujesz, odkładasz na później. Z przystanków układasz podróże — własne trasy przez muzykę, którymi możesz się z kimś podzielić. Do tego koncerty w Twoich miastach.",

  dataTitle: "Skąd dane",
  dataBody:
    "MusicBrainz to podstawa: składy, dyskografie, kredyty. Braki łatamy Wikidanymi i Wikipedią, koncerty dochodzą z Ticketmastera, okładki z Cover Art Archive. Oceny i komentarze są nasze — wpisujecie je Wy. Nie budujemy własnej bazy muzycznej; korzystamy z otwartych i mówimy, z której akurat.",

  gapsTitle: "Czego nie zobaczysz",
  gapsBody:
    "Bazy bywają dziurawe, zwłaszcza przy mniejszych wydawnictwach i poza anglosaskim światem. Zobaczysz wtedy „?” zamiast dat, przerywaną kreskę na osi czasu albo podpis, że dane pochodzą z Wikipedii. To celowe: wolimy pokazać niepewną informację z zaznaczeniem, skąd jest, niż udawać, że czegoś nie było. Jeśli czegoś brakuje — najczęściej naprawdę nie ma tego w MusicBrainz i można to tam dopisać.",

  privacyTitle: "Twoje dane",
  privacyBody:
    "Logowanie idzie przez zewnętrznego dostawcę — hasła u nas nie ma. Trzymamy to, co sam wpiszesz: gatunki, oceny, komentarze, ulubione, podróże i miasta koncertowe. Nic z tego nie idzie dalej.",

  backHome: "Wróć na stronę główną",
  onboardingBody:
    "Portal prowadzi po muzyce spoza głównego nurtu: premiery, składy, kto z kim grał, koncerty i podróże układane z płyt oraz zespołów.",
  onboardingMore: "więcej o portalu →",
};
type T = typeof pl;

const en: T = {
  navHint: "About",
  title: "What this is",
  lead: "Pure New Shit is a guide to music off the mainstream — metal, prog and jazz above all, though not only. It neither sells music nor plays it: it points you to it and shows how things connect.",

  whatTitle: "What you do here",
  whatBody:
    "You browse Friday releases ordered around your genres, open an album or a band and keep pulling the thread: who was in the line-up, what else they play on, who produced it and what else they produced. You rate, comment, save for later. Out of those stops you build journeys — your own routes through music, which you can hand to someone else. Plus concerts in your cities.",

  dataTitle: "Where the data comes from",
  dataBody:
    "MusicBrainz is the backbone: line-ups, discographies, credits. Gaps are patched from Wikidata and Wikipedia, concerts come from Ticketmaster, covers from the Cover Art Archive. Ratings and comments are ours — you write them. We don't build our own music database; we use the open ones and say which one we're quoting.",

  gapsTitle: "What you won't see",
  gapsBody:
    "These databases have holes, especially for smaller labels and outside the Anglo world. You'll then get a “?” instead of dates, a dashed bar on the timeline, or a note that something came from Wikipedia. That's deliberate: better an uncertain fact with its source shown than pretending it never happened. If something is missing, it usually really is missing from MusicBrainz — and can be added there.",

  privacyTitle: "Your data",
  privacyBody:
    "Sign-in goes through an outside provider — we hold no password. We keep what you enter yourself: genres, ratings, comments, favourites, journeys and concert cities. None of it goes anywhere else.",

  backHome: "Back to the home page",
  onboardingBody:
    "The portal guides you through music off the mainstream: new releases, line-ups, who played with whom, concerts, and journeys built from albums and bands.",
  onboardingMore: "more about the portal →",
};

const es: T = {
  navHint: "Acerca de",
  title: "Qué es esto",
  lead: "Pure New Shit es una guía por la música fuera de la corriente principal — metal, prog y jazz sobre todo, aunque no solo. Ni vende música ni la reproduce: te lleva hasta ella y muestra cómo se conecta todo.",

  whatTitle: "Qué haces aquí",
  whatBody:
    "Recorres los estrenos de los viernes ordenados según tus géneros, entras en un disco o una banda y sigues tirando del hilo: quién estuvo en la formación, en qué más toca, quién lo produjo y qué más produjo. Puntúas, comentas, guardas para después. Con esas paradas armas viajes: tus propias rutas por la música, que puedes pasarle a alguien. Y conciertos en tus ciudades.",

  dataTitle: "De dónde salen los datos",
  dataBody:
    "MusicBrainz es la base: formaciones, discografías, créditos. Los huecos se rellenan con Wikidata y Wikipedia, los conciertos llegan de Ticketmaster y las portadas del Cover Art Archive. Las puntuaciones y los comentarios son nuestros: los escribís vosotros. No construimos una base musical propia; usamos las abiertas y decimos cuál estamos citando.",

  gapsTitle: "Lo que no verás",
  gapsBody:
    "Estas bases tienen agujeros, sobre todo en sellos pequeños y fuera del mundo anglosajón. Entonces verás un «?» en lugar de fechas, una barra discontinua en la línea de tiempo o una nota de que algo viene de Wikipedia. Es deliberado: mejor un dato incierto con su fuente a la vista que fingir que nunca ocurrió. Si algo falta, suele faltar de verdad en MusicBrainz — y allí se puede añadir.",

  privacyTitle: "Tus datos",
  privacyBody:
    "El acceso pasa por un proveedor externo: aquí no hay contraseña. Guardamos lo que tú introduces: géneros, puntuaciones, comentarios, favoritos, viajes y ciudades de conciertos. Nada de eso va a ninguna parte.",

  backHome: "Volver a la página principal",
  onboardingBody:
    "El portal te guía por la música fuera de la corriente principal: novedades, formaciones, quién tocó con quién, conciertos y viajes armados con discos y bandas.",
  onboardingMore: "más sobre el portal →",
};

const de: T = {
  navHint: "Über",
  title: "Was das hier ist",
  lead: "Pure New Shit ist ein Führer durch Musik abseits des Mainstreams — vor allem Metal, Prog und Jazz, aber nicht nur. Es verkauft keine Musik und spielt keine ab: es führt zu ihr hin und zeigt, wie alles zusammenhängt.",

  whatTitle: "Was du hier tust",
  whatBody:
    "Du siehst die Freitagsveröffentlichungen nach deinen Genres sortiert, öffnest ein Album oder eine Band und ziehst den Faden weiter: wer in der Besetzung war, wo er sonst spielt, wer produziert hat und was er sonst produziert hat. Du bewertest, kommentierst, legst für später zurück. Aus diesen Halten baust du Reisen — eigene Routen durch die Musik, die du weitergeben kannst. Dazu Konzerte in deinen Städten.",

  dataTitle: "Woher die Daten kommen",
  dataBody:
    "MusicBrainz ist das Rückgrat: Besetzungen, Diskografien, Credits. Lücken stopfen Wikidata und Wikipedia, Konzerte kommen von Ticketmaster, Cover aus dem Cover Art Archive. Bewertungen und Kommentare sind unsere — die schreibt ihr. Wir bauen keine eigene Musikdatenbank; wir nutzen die offenen und sagen dazu, welche wir gerade zitieren.",

  gapsTitle: "Was du nicht sehen wirst",
  gapsBody:
    "Diese Datenbanken haben Löcher, besonders bei kleinen Labels und außerhalb der angelsächsischen Welt. Dann steht da ein „?“ statt eines Datums, ein gestrichelter Balken in der Zeitleiste oder ein Hinweis, dass etwas aus Wikipedia stammt. Das ist Absicht: lieber eine unsichere Angabe mit sichtbarer Quelle, als so zu tun, als hätte es das nie gegeben. Fehlt etwas, fehlt es meist wirklich in MusicBrainz — und lässt sich dort ergänzen.",

  privacyTitle: "Deine Daten",
  privacyBody:
    "Die Anmeldung läuft über einen externen Anbieter — ein Passwort liegt bei uns nicht. Wir behalten, was du selbst einträgst: Genres, Bewertungen, Kommentare, Favoriten, Reisen und Konzertstädte. Nichts davon geht weiter.",

  backHome: "Zurück zur Startseite",
  onboardingBody:
    "Das Portal führt durch Musik abseits des Mainstreams: Neuerscheinungen, Besetzungen, wer mit wem gespielt hat, Konzerte und Reisen aus Alben und Bands.",
  onboardingMore: "mehr über das Portal →",
};

export const about: Record<Locale, T> = { pl, en, es, de };
