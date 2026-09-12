import { addToListAction } from "@/app/actions";
import { MenuZamykane } from "./menu-zamykane";
import type { ListTarget } from "@/lib/user-data";

/**
 * „Do listy" — jedno rozwijane menu zamiast osobnego ekranu.
 *
 * Świadomie `<details>` i zwykły formularz: bez javascriptu, działa też wtedy,
 * gdy strona jeszcze się doładowuje. Można wybrać istniejącą listę albo od razu
 * założyć nową — bo pomysł na listę zwykle przychodzi przy konkretnej płycie,
 * a nie w spisie list.
 *
 * Opakowane w `MenuZamykane`, bo to menu wisi NAD treścią: samo `<details>`
 * zwija się tylko ponownym kliknięciem w nagłówek, więc kliknięcie obok
 * wyglądało na zacięcie. Teraz zamyka je też Escape.
 */
export function AddToList({
  type,
  mbid,
  label,
  url,
  lists,
  already,
  t,
}: {
  type: ListTarget;
  mbid: string;
  label: string;
  /** koncert nie ma u nas strony — zapamiętujemy link do afisza */
  url?: string | null;
  lists: { id: string; title: string }[];
  /** id list, na których to już jest — żeby nie dokładać po raz drugi */
  already: string[];
  t: {
    addTo: string;
    pick: string;
    newList: string;
    newPlaceholder: string;
    add: string;
    onList: string;
  };
}) {
  const dostepne = lists.filter((l) => !already.includes(l.id));
  return (
    <MenuZamykane className="relative">
      <summary className="btn cursor-pointer list-none">
        {already.length ? `${t.addTo} · ${already.length}` : t.addTo}
      </summary>
      <div className="absolute left-0 z-10 mt-1 w-72 rounded-lg border border-rule bg-surface p-3 shadow-lg">
        {already.length > 0 && (
          <p className="mb-2 font-mono text-[10px] text-faint">
            {t.onList}: {lists.filter((l) => already.includes(l.id)).map((l) => l.title).join(", ")}
          </p>
        )}
        <form action={addToListAction} className="space-y-2">
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="mbid" value={mbid} />
          <input type="hidden" name="label" value={label} />
          {url && <input type="hidden" name="url" value={url} />}
          {dostepne.length > 0 && (
            <label className="block text-xs text-muted">
              {t.pick}
              <select name="listId" className="input mt-1 py-1 text-sm" defaultValue="">
                <option value="">—</option>
                {dostepne.map((l) => (
                  <option key={l.id} value={l.id}>{l.title}</option>
                ))}
              </select>
            </label>
          )}
          <label className="block text-xs text-muted">
            {t.newList}
            <input name="newList" placeholder={t.newPlaceholder} className="input mt-1 py-1 text-sm" autoComplete="off" />
          </label>
          <button className="btn btn-accent w-full justify-center">{t.add}</button>
        </form>
      </div>
    </MenuZamykane>
  );
}
