export function SearchBox({
  defaultValue = "",
  big = false,
  placeholder,
  label,
}: {
  defaultValue?: string;
  big?: boolean;
  /** napisy przychodzą od rodzica — tylko serwer wie, jaki język wybrał człowiek */
  placeholder: string;
  label: string;
}) {
  return (
    <form action="/szukaj" className={big ? "flex gap-2" : "w-full"}>
      <input
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-label={label}
        className={big ? "input text-lg" : "input w-full py-1.5 text-sm"}
        autoComplete="off"
      />
      {big && <button className="btn btn-accent">{label}</button>}
    </form>
  );
}
