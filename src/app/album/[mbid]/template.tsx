/**
 * Wymusza ponowne zamontowanie strony przy przejściu w obrębie tej samej trasy
 * (np. z /artist/A na /artist/B — klik w zespół na stronie muzyka).
 *
 * Bez tego Next.js zachowuje zamontowany segment i NIE pokazuje loading.tsx:
 * ekran stoi bez reakcji przez kilka sekund, w których czekamy na MusicBrainz,
 * i wygląda jakby kliknięcie nie zadziałało. Template montuje się od nowa przy
 * każdej nawigacji, więc szkielet ładowania pojawia się tak samo jak przy
 * wejściu z zewnątrz.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return children;
}
