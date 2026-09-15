import { toggleDoPosluchania } from "@/app/actions";
import type { ListTarget } from "@/lib/user-data";

/**
 * „Do posłuchania" — jeden przycisk, jedno kliknięcie, w obie strony.
 *
 * Osobno od „Do podróży", choć technicznie to też lista. Różnica jest w tym,
 * po co się klika: podróż układa się komuś (albo sobie na później, ale
 * świadomie), a to jest kolejka — „nie teraz, ale nie chcę tego zgubić".
 * Gdyby trzeba było przy tym wybierać, na którą z siedmiu list to wrzucić,
 * nikt by nic nie odkładał.
 *
 * Zwykły formularz, żeby działało bez JavaScriptu — jak wszystko w portalu.
 */
export function DoPosluchania({
  type,
  mbid,
  label,
  url,
  jest,
  t,
}: {
  type: ListTarget;
  mbid: string;
  label: string;
  url?: string | null;
  /** czy już leży w kolejce — ten sam przycisk wtedy zdejmuje */
  jest: boolean;
  t: { add: string; on: string; remove: string };
}) {
  return (
    <form action={toggleDoPosluchania}>
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="mbid" value={mbid} />
      <input type="hidden" name="label" value={label} />
      {url && <input type="hidden" name="url" value={url} />}
      <button className={jest ? "btn btn-warn" : "btn"} title={jest ? t.remove : t.add}>
        {jest ? `${t.on} ✓` : t.add}
      </button>
    </form>
  );
}
