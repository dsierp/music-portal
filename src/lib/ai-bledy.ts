/**
 * Tłumaczenie tego, co powiedział dostawca modelu, na polski dla człowieka.
 *
 * Surowy komunikat jest bezcenny przy szukaniu przyczyny i dlatego zostaje na
 * ekranie małym drukiem. Ale sam w sobie mówi „insufficient_quota" albo
 * „Odpowiedź modelu nie jest poprawnym JSON-em" — czyli w najlepszym razie nic,
 * a w najgorszym sugeruje awarię portalu tam, gdzie model po prostu odmówił.
 *
 * Tłumaczymy TUTAJ, bez pytania modelu o wyjaśnienie własnego błędu: gdy model
 * nie odpowiada, dokładanie mu drugiego zapytania jest najsłabszym możliwym
 * planem (kosztuje, zwykle pada tak samo, a przy odmowie potrafi ją powtórzyć).
 * Wzorce są krótkie i pokrywają to, co naprawdę przychodzi od dostawców.
 */
export interface Wyjasnienie {
  /** jedno zdanie: co się stało */
  co: string;
  /** jedno zdanie: co z tym zrobić — albo null, gdy nie ma nic do zrobienia */
  rada: string | null;
  /** czy warto po prostu spróbować jeszcze raz tym samym pytaniem */
  ponow: boolean;
  /** słowa modelu, gdy to on coś powiedział (odmowa) */
  cytat?: string | null;
}

export function wyjasnijBlad(szczegol: string | null | undefined): Wyjasnienie | null {
  const s = (szczegol ?? "").trim();
  if (!s) return null;

  // Odmowa modelu — oznaczona już w ai.ts, bo tylko tam widać surowy tekst.
  if (s.startsWith("ODMOWA::")) {
    return {
      co: "Model nie chciał odpowiedzieć na to pytanie.",
      rada: "Spróbuj zapytać inaczej — konkretniej albo innymi słowami. To nie jest usterka portalu.",
      ponow: false,
      cytat: s.slice("ODMOWA::".length).trim() || null,
    };
  }
  if (/nie jest poprawnym JSON/i.test(s)) {
    return {
      co: "Model odpowiedział, ale nie w tej formie, o którą portal prosił — więc nie ma z czego zrobić listy płyt.",
      rada: "Zwykle pomaga powtórzenie pytania; to kaprys modelu, nie stan trwały.",
      ponow: true,
    };
  }
  if (/limit|429|rate.?limit|quota/i.test(s)) {
    return {
      co: "Model jest chwilowo przeciążony i przyciął nas limitem.",
      rada: "Odczekaj kilka minut i spróbuj jeszcze raz.",
      ponow: true,
    };
  }
  if (/402|środk|insufficient|credit|billing/i.test(s)) {
    return {
      co: "Konto, z którego portal korzysta z modelu, nie ma środków na to zapytanie.",
      rada: "To rzecz do załatwienia po stronie właściciela portalu.",
      ponow: false,
    };
  }
  if (/401|odrzucony|unauthorized|invalid api key/i.test(s)) {
    return {
      co: "Model nie przyjął klucza portalu.",
      rada: "Klucz wygasł albo został podmieniony — trzeba go poprawić w konfiguracji.",
      ponow: false,
    };
  }
  if (/404|odrzucony: |model.*(nie istnieje|not found)/i.test(s)) {
    return {
      co: "Model, o który prosi portal, nie jest już dostępny.",
      rada: "Nazwa modelu w konfiguracji jest nieaktualna albo z literówką.",
      ponow: false,
    };
  }
  if (/bez treści|finish_reason|urwał odpowiedź/i.test(s)) {
    return {
      co: "Model zaczął odpowiadać i urwał, nie mówiąc nic konkretnego.",
      rada: "Spróbuj jeszcze raz — przy krótszym pytaniu zdarza się to rzadziej.",
      ponow: true,
    };
  }
  if (/timeout|abort|Nie udało się połączyć|ECONNRESET|network/i.test(s)) {
    return {
      co: "Nie udało się dogadać z modelem — połączenie padło albo trwało za długo.",
      rada: "Spróbuj jeszcze raz za chwilę.",
      ponow: true,
    };
  }
  if (/MusicBrainz/i.test(s)) {
    return {
      co: "Model coś zaproponował, ale baza, w której portal sprawdza płyty, nie odpowiadała — więc nie było czym tego potwierdzić.",
      rada: "Portal nie pokazuje płyt niepotwierdzonych — spróbuj za chwilę.",
      ponow: true,
    };
  }
  return null;
}
