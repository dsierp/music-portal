import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { currentUser } from "@/lib/auth";
import { canSeeList, getList, otherUsers, sharedWith } from "@/lib/user-data";
import { deleteListAction, removeFromListAction, shareListAction } from "@/app/actions";
import { Cover } from "@/components/cover";
import { i18n } from "@/lib/t";
import { fmt, formatDate, plural } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const data = await getList((await params).id).catch(() => null);
  return { title: data?.list.title ?? "" };
}

/**
 * Jedna lista: pozycje w kolejności, w jakiej ułożył je autor, i — dla autora —
 * polecenie jej konkretnym osobom.
 *
 * Lista jest prywatna: widzi ją autor i ci, którym ją polecił. Bez publicznych
 * adresów „na skróty" — polecenie ma być gestem wobec kogoś, a nie publikacją.
 */
export default async function ListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { locale, t } = await i18n();
  const user = await currentUser();
  const data = await getList(id).catch(() => null);
  if (!data) notFound();
  const moja = user?.id === data.list.userId;
  if (!(await canSeeList(user?.id ?? null, id, data.list.userId))) notFound();

  const [ludzie, wyslane] = moja
    ? await Promise.all([otherUsers(user!.id), sharedWith(id)])
    : [[] as { id: string; name: string }[], [] as { userId: string; dismissedAt: Date | null }[]];
  const juzPolecone = new Set(wyslane.map((w) => w.userId));

  return (
    <div className="space-y-6">
      <header>
        <div className="label">{moja ? t.lists.myListsTitle : t.lists.listBy}</div>
        <h1 className="text-4xl">{data.list.title}</h1>
        {data.list.description && <p className="mt-2 max-w-2xl text-text2">{data.list.description}</p>}
        <p className="mt-1 font-mono text-xs text-muted">
          {plural(locale, data.items.length, t.lists.itemsCount)} · {formatDate(data.list.updatedAt.toISOString().slice(0, 10), locale, { year: true })}
        </p>
      </header>

      {data.items.length ? (
        <ol className="space-y-2">
          {data.items.map((it, i) => (
            <li key={`${it.targetType}-${it.targetMbid}`} className="flex items-center gap-3 rounded-lg border border-rule bg-surface p-2">
              <span className="w-6 shrink-0 text-center font-mono text-sm text-faint">{i + 1}</span>
              {it.targetType === "ALBUM" ? <Cover mbid={it.targetMbid} size={44} /> : null}
              <div className="min-w-0 flex-1">
                {/* Koncert nie ma u nas strony — prowadzimy na afisz, do którego
                    i tak trzeba pójść po bilet. */}
                {it.targetType === "CONCERT" ? (
                  it.url ? (
                    <a href={it.url} target="_blank" rel="noopener" className="block truncate font-medium hover:text-accent2 hover:underline">
                      {it.label}
                    </a>
                  ) : (
                    <span className="block truncate font-medium">{it.label}</span>
                  )
                ) : (
                  <Link
                    href={it.targetType === "ALBUM" ? `/album/${it.targetMbid}` : `/artist/${it.targetMbid}`}
                    className="block truncate font-medium hover:text-accent2 hover:underline"
                  >
                    {it.label}
                  </Link>
                )}
                <span className="font-mono text-[10px] uppercase text-faint">
                  {it.targetType === "ALBUM" ? t.common.album : it.targetType === "ARTIST" ? t.common.band : t.nav.concerts}
                </span>
                {it.note && <p className="text-xs text-muted">{it.note}</p>}
              </div>
              {moja && (
                <form action={removeFromListAction}>
                  <input type="hidden" name="listId" value={id} />
                  <input type="hidden" name="type" value={it.targetType} />
                  <input type="hidden" name="mbid" value={it.targetMbid} />
                  <button className="text-xs text-muted hover:text-accent2">{t.lists.removeItem}</button>
                </form>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted">{t.lists.emptyMyList}</p>
      )}

      {moja && (
        <section className="card">
          <h2 className="text-xl">{t.lists.shareTitle}</h2>
          {ludzie.length ? (
            <form action={shareListAction} className="mt-2 space-y-2">
              <input type="hidden" name="listId" value={id} />
              <div className="flex flex-wrap gap-3">
                {ludzie.map((p) => (
                  <label key={p.id} className="flex items-center gap-1.5 text-sm">
                    <input type="checkbox" name="to" value={p.id} defaultChecked={juzPolecone.has(p.id)} />
                    {p.name}
                  </label>
                ))}
              </div>
              <input name="note" placeholder={t.lists.shareNote} className="input py-1 text-sm" autoComplete="off" />
              <button className="btn btn-accent">{t.lists.shareSubmit}</button>
              {juzPolecone.size > 0 && (
                <p className="font-mono text-[10px] text-faint">
                  {fmt(t.lists.sharedAlready, {
                    names: ludzie.filter((p) => juzPolecone.has(p.id)).map((p) => p.name).join(", "),
                  })}
                </p>
              )}
            </form>
          ) : (
            <p className="mt-2 text-sm text-muted">{t.lists.shareNoUsers}</p>
          )}
        </section>
      )}

      {moja && (
        <form action={deleteListAction}>
          <input type="hidden" name="listId" value={id} />
          <button className="text-xs text-muted hover:text-warn">{t.lists.deleteList}</button>
        </form>
      )}
    </div>
  );
}
