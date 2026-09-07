import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { logout } from "@/app/actions";
import { SearchBox } from "./search-box";

export async function Nav() {
  const user = await currentUser();
  return (
    <header className="sticky top-0 z-20 border-b border-rule bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="display text-2xl font-bold tracking-wide text-text hover:text-accent2">
          PURE <span className="text-accent">NEW</span> SHIT
        </Link>
        <nav className="flex gap-4 text-sm text-text2">
          <Link href="/premiery">Premiery</Link>
          <Link href="/best-of">Best of</Link>
          <Link href="/listy">Listy</Link>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <SearchBox />
          {user ? (
            <div className="flex items-center gap-2 text-sm">
              <Link href="/ja" className="btn">
                {user.image ? <img src={user.image} alt="" className="h-5 w-5 rounded-full" /> : null}
                {user.name || user.email}
              </Link>
              <form action={logout}>
                <button className="text-xs text-muted hover:text-accent2">wyloguj</button>
              </form>
            </div>
          ) : (
            <Link href="/login" className="btn btn-accent">Zaloguj</Link>
          )}
        </div>
      </div>
    </header>
  );
}
