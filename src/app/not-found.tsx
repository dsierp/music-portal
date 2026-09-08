import Link from "next/link";
import { i18n } from "@/lib/t";

export default async function NotFound() {
  const { t } = await i18n();
  return (
    <div className="py-20 text-center">
      <h1 className="text-5xl">404</h1>
      <p className="mt-2 text-muted">{t.search.notFoundBody}</p>
      <Link href="/szukaj" className="btn mt-6">{t.nav.search}</Link>
    </div>
  );
}
