export function SearchBox({ defaultValue = "", big = false }: { defaultValue?: string; big?: boolean }) {
  return (
    <form action="/szukaj" className={big ? "flex gap-2" : "hidden md:block"}>
      <input
        name="q"
        defaultValue={defaultValue}
        placeholder="Szukaj płyty, zespołu, muzyka…"
        className={big ? "input text-lg" : "input w-64 py-1 text-sm"}
        autoComplete="off"
      />
      {big && <button className="btn btn-accent">Szukaj</button>}
    </form>
  );
}
