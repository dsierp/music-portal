/**
 * Pasek pokazywany, gdy lokalna baza nie odpowiada. Reszta strony (dane
 * z MusicBrainz/Wikipedii) działa normalnie — nie ma powodu jej ukrywać.
 */
export function DbWarning() {
  return (
    <div className="mb-4 rounded border border-red-500/40 bg-red-500/10 p-3 text-sm">
      <strong className="block">Lokalna baza nie odpowiada.</strong>
      <span className="text-text2">
        Oceny, komentarze i ulubione są chwilowo niedostępne — opis płyty i skład czytamy z MusicBrainz, więc widać je normalnie.
        Najczęstsza przyczyna: serwer był ubity w trakcie zapisu albo dwa procesy pisały do jednej bazy. Naprawa:{" "}
        <code className="font-mono text-accent2">npm run db:reset</code>, potem <code className="font-mono text-accent2">npm run dev</code>.
      </span>
    </div>
  );
}
