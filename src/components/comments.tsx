import { comment, deleteCommentAction, editCommentAction } from "@/app/actions";
import type { CommentNode, Target } from "@/lib/user-data";

function when(d: Date) {
  return d.toLocaleString("pl-PL", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Warsaw" });
}

function CommentForm({ type, mbid, parentId, placeholder }: { type: Target; mbid: string; parentId?: string; placeholder: string }) {
  return (
    <form action={comment} className="mt-2 flex flex-col gap-2">
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="mbid" value={mbid} />
      {parentId && <input type="hidden" name="parentId" value={parentId} />}
      <textarea name="body" required minLength={2} maxLength={4000} rows={parentId ? 2 : 3} placeholder={placeholder} className="input" />
      <div>
        <button className="btn btn-accent">{parentId ? "Odpowiedz" : "Dodaj komentarz"}</button>
      </div>
    </form>
  );
}

function Item({ node, type, mbid, userId, depth }: { node: CommentNode; type: Target; mbid: string; userId: string | null; depth: number }) {
  const mine = userId === node.userId;
  return (
    <li className={depth ? "ml-6 border-l border-rule pl-4" : ""}>
      <div className="flex items-center gap-2 text-xs text-muted">
        {node.userImage && <img src={node.userImage} alt="" className="h-4 w-4 rounded-full" />}
        <span className="font-medium text-text2">{node.userName}</span>
        <span className="font-mono">{when(node.createdAt)}</span>
        {node.updatedAt.getTime() - node.createdAt.getTime() > 60_000 && !node.deleted && <span>(edytowany)</span>}
      </div>
      {node.deleted ? (
        <p className="mt-1 text-sm italic text-faint">[komentarz usunięty]</p>
      ) : (
        <p className="mt-1 whitespace-pre-wrap text-sm">{node.body}</p>
      )}
      {userId && !node.deleted && (
        <div className="mt-1 flex gap-3 text-xs">
          <details>
            <summary className="cursor-pointer text-muted hover:text-accent2">odpowiedz</summary>
            <CommentForm type={type} mbid={mbid} parentId={node.id} placeholder={`Odpowiedź dla ${node.userName}…`} />
          </details>
          {mine && (
            <>
              <details>
                <summary className="cursor-pointer text-muted hover:text-accent2">edytuj</summary>
                <form action={editCommentAction} className="mt-2 flex flex-col gap-2">
                  <input type="hidden" name="type" value={type} />
                  <input type="hidden" name="mbid" value={mbid} />
                  <input type="hidden" name="commentId" value={node.id} />
                  <textarea name="body" defaultValue={node.body} rows={3} className="input" />
                  <div><button className="btn">Zapisz</button></div>
                </form>
              </details>
              <form action={deleteCommentAction}>
                <input type="hidden" name="type" value={type} />
                <input type="hidden" name="mbid" value={mbid} />
                <input type="hidden" name="commentId" value={node.id} />
                <button className="text-muted hover:text-accent2">usuń</button>
              </form>
            </>
          )}
        </div>
      )}
      {node.replies.length > 0 && (
        <ul className="mt-3 space-y-4">
          {node.replies.map((r) => <Item key={r.id} node={r} type={type} mbid={mbid} userId={userId} depth={depth + 1} />)}
        </ul>
      )}
    </li>
  );
}

export function Comments({ type, mbid, tree, userId }: { type: Target; mbid: string; tree: CommentNode[]; userId: string | null }) {
  const total = countAll(tree);
  return (
    <section className="card">
      <h3 className="text-lg">Komentarze <span className="font-mono text-sm text-muted">{total}</span></h3>
      {userId ? (
        <CommentForm type={type} mbid={mbid} placeholder="Co o tym myślisz?" />
      ) : (
        <p className="mt-2 text-sm text-muted"><a href="/login" className="hover:text-accent2">Zaloguj się</a>, żeby komentować.</p>
      )}
      {tree.length > 0 && (
        <ul className="mt-6 space-y-6">
          {tree.map((n) => <Item key={n.id} node={n} type={type} mbid={mbid} userId={userId} depth={0} />)}
        </ul>
      )}
    </section>
  );
}

function countAll(nodes: CommentNode[]): number {
  return nodes.reduce((s, n) => s + (n.deleted ? 0 : 1) + countAll(n.replies), 0);
}
