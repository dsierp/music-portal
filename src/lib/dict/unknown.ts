/**
 * Ekran „podróż w nieznane" — od opisu do listy płyt.
 *
 * Ton jest tu ważny: obiecujemy dokładnie tyle, ile portal potrafi. Model
 * proponuje, MusicBrainz potwierdza, a to, czego nie potwierdzi, nie trafia
 * na ekran. Napis na dole mówi o tym wprost, bo inaczej pierwsza chybiona
 * propozycja wygląda na awarię, a nie na cenę tej zabawy.
 */
import type { Locale } from "@/lib/i18n";

const pl = {
  eyebrow: "Podróż",
  title: "W nieznane",
  lead: "Napisz, czego chcesz posłuchać. Reszta portalu wie, dokąd jedziesz — ta jedna nie.",
  label: "Czego chcesz posłuchać?",
  placeholder: "Napisz jak do człowieka: nastrój, pora dnia, po czym ma to być, czego masz dość…",
  cta: "Ułóż podróż",
  working: "Szukam i sprawdzam…",
  slowNote: "Potrwa kilkanaście sekund — każdą płytę potwierdzam w MusicBrainz.",
  examplesLabel: "Na przykład",
  exPrime: "Coś ciężkiego, ale bez wrzasku. Wieczór, słuchawki, nie chcę się skupiać na tekstach.",
  exSecond: "Jazz, który nie jest tłem. Ma być niewygodnie, ale nie chaotycznie.",
  exThird: "Mam dość produkcji, w której wszystko jest równo. Chcę usłyszeć pomieszczenie.",
  honestNote: "Propozycje układa model językowy, ale każdą płytę portal potwierdza w MusicBrainz — czego nie potwierdzi, nie zobaczysz. Dzięki temu w każdą pozycję da się wejść i zobaczyć skład.",
  loginRest: ", żeby ułożyć podróż — zapisuje się na Twoim koncie.",
  noKey: "Ten ekran potrzebuje klucza do modelu językowego. Bez niego reszta portalu działa normalnie.",
  errors: {
    krotki: "Napisz trochę więcej — z dwóch słów nic nie ułożę.",
    limit: "Na dziś koniec — możesz ułożyć {n} podróży dziennie. Każda woła model językowy, a to kosztuje. Wróć jutro.",
    brakKlucza: "Model nie jest skonfigurowany.",
    model: "Model nie odpowiedział. Spróbuj jeszcze raz za chwilę.",
    mbAwaria: "MusicBrainz chwilowo nie odpowiada, więc nie mam czym potwierdzić propozycji. Spróbuj za chwilę.",
    pusto: "Nic z tego nie znalazło się w MusicBrainz. Spróbuj opisać to inaczej.",
    nieznany: "Coś poszło nie tak. Spróbuj jeszcze raz.",
  } as Record<string, string>,
};
type T = typeof pl;

const en: T = {
  eyebrow: "Journey",
  title: "Into the unknown",
  lead: "Write what you feel like hearing. The rest of the portal knows where you're going — this one doesn't.",
  label: "What do you feel like hearing?",
  placeholder: "Write it like you'd say it: mood, time of day, what it should follow, what you've had enough of…",
  cta: "Build the journey",
  working: "Looking and checking…",
  slowNote: "This takes a few seconds — every album gets confirmed against MusicBrainz.",
  examplesLabel: "For example",
  exPrime: "Something heavy but without screaming. Evening, headphones, I don't want to follow lyrics.",
  exSecond: "Jazz that isn't background. Uncomfortable, but not chaotic.",
  exThird: "I'm tired of records where everything is levelled. I want to hear the room.",
  honestNote: "A language model puts the suggestions together, but the portal confirms every album against MusicBrainz — anything it can't confirm, you won't see. That's why every entry opens into a real line-up.",
  loginRest: " to build a journey — it gets saved to your account.",
  noKey: "This screen needs a language-model key. Without it the rest of the portal works as usual.",
  errors: {
    krotki: "Write a bit more — two words aren't enough to go on.",
    limit: "That's it for today — {n} journeys a day. Each one calls a language model, and that costs money. Come back tomorrow.",
    brakKlucza: "The model isn't configured.",
    model: "The model didn't answer. Try again in a moment.",
    mbAwaria: "MusicBrainz isn't answering, so there's nothing to confirm the suggestions against. Try again shortly.",
    pusto: "None of it turned up in MusicBrainz. Try describing it differently.",
    nieznany: "Something went wrong. Try again.",
  },
};

const es: T = {
  eyebrow: "Viaje",
  title: "Hacia lo desconocido",
  lead: "Escribe qué te apetece escuchar. El resto del portal sabe adónde vas; este no.",
  label: "¿Qué te apetece escuchar?",
  placeholder: "Escríbelo como lo dirías: ánimo, hora del día, después de qué, de qué estás harto…",
  cta: "Armar el viaje",
  working: "Buscando y comprobando…",
  slowNote: "Tarda unos segundos: cada disco se confirma en MusicBrainz.",
  examplesLabel: "Por ejemplo",
  exPrime: "Algo pesado pero sin gritos. De noche, con auriculares, sin seguir las letras.",
  exSecond: "Jazz que no sea de fondo. Incómodo, pero no caótico.",
  exThird: "Estoy harto de discos donde todo suena nivelado. Quiero oír la sala.",
  honestNote: "Las propuestas las arma un modelo de lenguaje, pero el portal confirma cada disco en MusicBrainz: lo que no se confirme, no lo verás. Por eso cada entrada abre una formación real.",
  loginRest: " para armar un viaje: se guarda en tu cuenta.",
  noKey: "Esta pantalla necesita una clave de modelo de lenguaje. Sin ella el resto del portal funciona igual.",
  errors: {
    krotki: "Escribe un poco más: con dos palabras no puedo armar nada.",
    limit: "Por hoy basta: {n} viajes al día. Cada uno llama a un modelo de lenguaje y eso cuesta. Vuelve mañana.",
    brakKlucza: "El modelo no está configurado.",
    model: "El modelo no respondió. Inténtalo de nuevo en un momento.",
    mbAwaria: "MusicBrainz no responde, así que no tengo con qué confirmar las propuestas. Inténtalo en un rato.",
    pusto: "Nada de eso apareció en MusicBrainz. Prueba a describirlo de otra manera.",
    nieznany: "Algo salió mal. Inténtalo de nuevo.",
  },
};

const de: T = {
  eyebrow: "Reise",
  title: "Ins Unbekannte",
  lead: "Schreib, wonach dir ist. Der Rest des Portals weiß, wohin du willst — dieser Teil nicht.",
  label: "Wonach ist dir?",
  placeholder: "Schreib es, wie du es sagen würdest: Stimmung, Tageszeit, worauf es folgen soll, wovon du genug hast…",
  cta: "Reise zusammenstellen",
  working: "Suche und prüfe…",
  slowNote: "Dauert ein paar Sekunden — jedes Album wird gegen MusicBrainz geprüft.",
  examplesLabel: "Zum Beispiel",
  exPrime: "Etwas Schweres, aber ohne Geschrei. Abends, Kopfhörer, ohne auf Texte zu achten.",
  exSecond: "Jazz, der kein Hintergrund ist. Unbequem, aber nicht chaotisch.",
  exThird: "Ich habe genug von Produktionen, in denen alles gleich laut ist. Ich will den Raum hören.",
  honestNote: "Die Vorschläge stellt ein Sprachmodell zusammen, aber das Portal bestätigt jedes Album über MusicBrainz — was sich nicht bestätigen lässt, siehst du nicht. Deshalb führt jeder Eintrag zu einer echten Besetzung.",
  loginRest: ", um eine Reise zusammenzustellen — sie wird in deinem Konto gespeichert.",
  noKey: "Dieser Bildschirm braucht einen Schlüssel für das Sprachmodell. Ohne ihn läuft der Rest des Portals wie gewohnt.",
  errors: {
    krotki: "Schreib etwas mehr — aus zwei Wörtern lässt sich nichts bauen.",
    limit: "Für heute Schluss — {n} Reisen pro Tag. Jede ruft ein Sprachmodell auf, und das kostet. Komm morgen wieder.",
    brakKlucza: "Das Modell ist nicht konfiguriert.",
    model: "Das Modell hat nicht geantwortet. Versuch es gleich noch einmal.",
    mbAwaria: "MusicBrainz antwortet gerade nicht, also fehlt die Bestätigung für die Vorschläge. Versuch es später.",
    pusto: "Nichts davon war in MusicBrainz zu finden. Beschreib es anders.",
    nieznany: "Etwas ist schiefgegangen. Versuch es noch einmal.",
  },
};

export const unknown: Record<Locale, T> = { pl, en, es, de };
