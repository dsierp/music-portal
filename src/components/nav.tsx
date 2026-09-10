import Link from "next/link";
import { Suspense } from "react";
import { currentUser } from "@/lib/auth";
import { logout } from "@/app/actions";
import { SearchBox } from "./search-box";
import { LanguagePicker } from "./language-picker";
import { i18n } from "@/lib/t";
import { getUserLocale } from "@/lib/user-data";

export async function Nav() {
  const user = await currentUser();
  // Profil pytamy tylko dla zalogowanych i tylko o język — ciasteczko i tak ma
  // pierwszeństwo, więc przy gościu nie ruszamy bazy w ogóle.
  const profileLocale = user ? await getUserLocale(user.id).catch(() => null) : null;
  const { locale, t } = await i18n(profileLocale);
  return (
    <header className="sticky top-0 z-20 border-b border-rule bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-[min(96rem,95vw)] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="display text-2xl font-bold tracking-wide text-text hover:text-accent2">
          PURE <span className="text-accent">NEW</span> SHIT
        </Link>
        <nav className="flex gap-4 text-sm text-text2">
          <Link href="/premiery">{t.nav.releases}</Link>
          <Link href="/koncerty">{t.nav.concerts}</Link>
          <Link href="/best-of">{t.nav.bestOf}</Link>
          <Link href="/podroze">{t.nav.lists}</Link>
          {/* Znak zapytania zamiast słowa: w menu jest już ciasno, a to i tak
              zagląda się raz. Tytuł niesie nazwę dla czytników ekranu. */}
          <Link href="/pomoc" title={t.help.guideTitle} aria-label={t.help.guideTitle} className="font-mono text-muted hover:text-accent2">
            ?
          </Link>
        </nav>
        <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-3">
          <div className="hidden min-w-0 max-w-md flex-1 md:block"><SearchBox placeholder={t.nav.searchPlaceholder} label={t.nav.search} /></div>
          <Suspense fallback={null}>
            <LanguagePicker locale={locale} label={t.nav.language} />
          </Suspense>
          {user ? (
            <div className="flex items-center gap-2 text-sm">
              <Link href="/ja" className="btn">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {user.image ? <img src={user.image} alt="" className="h-5 w-5 rounded-full" /> : null}
                {user.name || user.email}
              </Link>
              <form action={logout}>
                <button className="text-xs text-muted hover:text-accent2">{t.nav.logOut}</button>
              </form>
            </div>
          ) : (
            <Link href="/login" className="btn btn-accent">{t.nav.logIn}</Link>
          )}
        </div>
      </div>
    </header>
  );
}
