/**
 * Dane użytkowników: oceny, komentarze, preferencje, ulubione.
 * Czyste funkcje bazodanowe — bez sprawdzania sesji (to robią server actions).
 */
import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";

export type Target = "ALBUM" | "ARTIST";

// ---------- oceny ----------

export interface RatingSummary {
  avg: number | null;
  count: number;
  histogram: number[]; // indeks 1..10
  mine: number | null;
}

export async function ratingSummary(type: Target, mbid: string, userId?: string | null): Promise<RatingSummary> {
  const rows = await db
    .select({ score: schema.ratings.score, n: count() })
    .from(schema.ratings)
    .where(and(eq(schema.ratings.targetType, type), eq(schema.ratings.targetMbid, mbid)))
    .groupBy(schema.ratings.score);
  const histogram = new Array(11).fill(0);
  let total = 0, sum = 0;
  for (const r of rows) {
    histogram[r.score] = Number(r.n);
    total += Number(r.n);
    sum += r.score * Number(r.n);
  }
  let mine: number | null = null;
  if (userId) {
    const m = await db.query.ratings.findFirst({
      where: and(eq(schema.ratings.userId, userId), eq(schema.ratings.targetType, type), eq(schema.ratings.targetMbid, mbid)),
    });
    mine = m?.score ?? null;
  }
  return { avg: total ? Math.round((sum / total) * 10) / 10 : null, count: total, histogram, mine };
}

export async function setRating(userId: string, type: Target, mbid: string, score: number | null, label?: string | null) {
  if (score === null) {
    await db.delete(schema.ratings).where(and(eq(schema.ratings.userId, userId), eq(schema.ratings.targetType, type), eq(schema.ratings.targetMbid, mbid)));
    return;
  }
  const s = Math.max(1, Math.min(10, Math.round(score)));
  await db
    .insert(schema.ratings)
    .values({ userId, targetType: type, targetMbid: mbid, score: s, label: label ?? null })
    .onConflictDoUpdate({ target: [schema.ratings.userId, schema.ratings.targetType, schema.ratings.targetMbid], set: { score: s, label: label ?? null, updatedAt: new Date() } });
}

/** Średnie ocen dla wielu obiektów naraz (do list). */
export async function ratingAverages(type: Target, mbids: string[]) {
  if (!mbids.length) return new Map<string, { avg: number; count: number }>();
  const rows = await db
    .select({ mbid: schema.ratings.targetMbid, avg: sql<number>`avg(${schema.ratings.score})`, n: count() })
    .from(schema.ratings)
    .where(and(eq(schema.ratings.targetType, type), inArray(schema.ratings.targetMbid, mbids)))
    .groupBy(schema.ratings.targetMbid);
  return new Map(rows.map((r) => [r.mbid, { avg: Math.round(Number(r.avg) * 10) / 10, count: Number(r.n) }]));
}

/** Najwyżej oceniane przez społeczność (min. 1 ocena). */
export async function topRated(type: Target, limit = 20) {
  return db
    .select({ mbid: schema.ratings.targetMbid, avg: sql<number>`avg(${schema.ratings.score})`, n: count() })
    .from(schema.ratings)
    .where(eq(schema.ratings.targetType, type))
    .groupBy(schema.ratings.targetMbid)
    .orderBy(desc(sql`avg(${schema.ratings.score})`), desc(count()))
    .limit(limit);
}

// ---------- komentarze ----------

export interface CommentNode {
  id: string;
  userId: string;
  userName: string;
  userImage: string | null;
  body: string;
  createdAt: Date;
  updatedAt: Date;
  deleted: boolean;
  replies: CommentNode[];
}

export async function commentTree(type: Target, mbid: string): Promise<CommentNode[]> {
  const rows = await db
    .select({
      id: schema.comments.id, userId: schema.comments.userId, parentId: schema.comments.parentId, body: schema.comments.body,
      createdAt: schema.comments.createdAt, updatedAt: schema.comments.updatedAt, deletedAt: schema.comments.deletedAt,
      userName: schema.users.name, userEmail: schema.users.email, userImage: schema.users.image,
    })
    .from(schema.comments)
    .innerJoin(schema.users, eq(schema.users.id, schema.comments.userId))
    .where(and(eq(schema.comments.targetType, type), eq(schema.comments.targetMbid, mbid)))
    .orderBy(asc(schema.comments.createdAt));
  const nodes = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];
  for (const r of rows) {
    nodes.set(r.id, {
      id: r.id, userId: r.userId, userName: r.userName || r.userEmail.split("@")[0], userImage: r.userImage,
      body: r.deletedAt ? "" : r.body, createdAt: r.createdAt, updatedAt: r.updatedAt, deleted: !!r.deletedAt, replies: [],
    });
  }
  for (const r of rows) {
    const n = nodes.get(r.id)!;
    const parent = r.parentId ? nodes.get(r.parentId) : null;
    if (parent) parent.replies.push(n);
    else roots.push(n);
  }
  // najnowsze wątki na górze, odpowiedzi chronologicznie
  roots.reverse();
  return roots.filter((n) => !n.deleted || n.replies.length);
}

export async function addComment(userId: string, type: Target, mbid: string, body: string, parentId?: string | null) {
  const text = body.trim();
  if (text.length < 2 || text.length > 4000) throw new Error("Komentarz musi mieć od 2 do 4000 znaków.");
  if (parentId) {
    const p = await db.query.comments.findFirst({ where: eq(schema.comments.id, parentId) });
    if (!p || p.targetMbid !== mbid) throw new Error("Nie ma takiego komentarza nadrzędnego.");
  }
  const [row] = await db.insert(schema.comments).values({ userId, targetType: type, targetMbid: mbid, body: text, parentId: parentId ?? null }).returning();
  return row;
}

export async function editComment(userId: string, id: string, body: string) {
  const text = body.trim();
  if (text.length < 2 || text.length > 4000) throw new Error("Komentarz musi mieć od 2 do 4000 znaków.");
  const res = await db.update(schema.comments).set({ body: text, updatedAt: new Date() })
    .where(and(eq(schema.comments.id, id), eq(schema.comments.userId, userId), isNull(schema.comments.deletedAt))).returning();
  if (!res.length) throw new Error("Brak uprawnień lub komentarz nie istnieje.");
}

export async function deleteComment(userId: string, id: string) {
  await db.update(schema.comments).set({ deletedAt: new Date() }).where(and(eq(schema.comments.id, id), eq(schema.comments.userId, userId)));
}

export async function commentCounts(type: Target, mbids: string[]) {
  if (!mbids.length) return new Map<string, number>();
  const rows = await db
    .select({ mbid: schema.comments.targetMbid, n: count() })
    .from(schema.comments)
    .where(and(eq(schema.comments.targetType, type), inArray(schema.comments.targetMbid, mbids), isNull(schema.comments.deletedAt)))
    .groupBy(schema.comments.targetMbid);
  return new Map(rows.map((r) => [r.mbid, Number(r.n)]));
}

export async function mostCommented(type: Target, limit = 20) {
  return db
    .select({ mbid: schema.comments.targetMbid, n: count() })
    .from(schema.comments)
    .where(and(eq(schema.comments.targetType, type), isNull(schema.comments.deletedAt)))
    .groupBy(schema.comments.targetMbid)
    .orderBy(desc(count()))
    .limit(limit);
}

export async function recentComments(limit = 10) {
  return db
    .select({
      id: schema.comments.id, targetType: schema.comments.targetType, targetMbid: schema.comments.targetMbid, body: schema.comments.body,
      createdAt: schema.comments.createdAt, userName: schema.users.name, userEmail: schema.users.email,
    })
    .from(schema.comments)
    .innerJoin(schema.users, eq(schema.users.id, schema.comments.userId))
    .where(isNull(schema.comments.deletedAt))
    .orderBy(desc(schema.comments.createdAt))
    .limit(limit);
}

// ---------- preferencje ----------

export async function getGenres(userId: string) {
  return db.select().from(schema.userGenres).where(eq(schema.userGenres.userId, userId)).orderBy(desc(schema.userGenres.weight), asc(schema.userGenres.genre));
}

export async function setGenre(userId: string, genre: string, weight: number | null) {
  const g = genre.trim().toLowerCase().slice(0, 60);
  if (!g) return;
  if (weight === null) {
    await db.delete(schema.userGenres).where(and(eq(schema.userGenres.userId, userId), eq(schema.userGenres.genre, g)));
    return;
  }
  const w = Math.max(1, Math.min(5, Math.round(weight)));
  await db.insert(schema.userGenres).values({ userId, genre: g, weight: w })
    .onConflictDoUpdate({ target: [schema.userGenres.userId, schema.userGenres.genre], set: { weight: w } });
}

export type Sentiment = "like" | "dislike";

export async function getLikedAlbums(userId: string, kind: Sentiment = "like") {
  return db
    .select()
    .from(schema.likedAlbums)
    .where(and(eq(schema.likedAlbums.userId, userId), eq(schema.likedAlbums.kind, kind)))
    .orderBy(desc(schema.likedAlbums.createdAt));
}
/** null = obojętny; inaczej „lubię" albo „nie moja bajka". */
export async function albumSentiment(userId: string, mbid: string): Promise<Sentiment | null> {
  const row = await db.query.likedAlbums.findFirst({
    where: and(eq(schema.likedAlbums.userId, userId), eq(schema.likedAlbums.mbid, mbid)),
    columns: { kind: true },
  });
  return row?.kind ?? null;
}
export async function isLiked(userId: string, mbid: string) {
  return (await albumSentiment(userId, mbid)) === "like";
}
export async function likeAlbum(
  userId: string,
  a: { mbid: string; title: string; artistName: string; artistMbid?: string | null; note?: string | null },
  kind: Sentiment = "like",
) {
  await db
    .insert(schema.likedAlbums)
    .values({ userId, mbid: a.mbid, title: a.title, artistName: a.artistName, artistMbid: a.artistMbid ?? null, note: a.note ?? null, kind })
    // Zmiana zdania ma nadpisywać, nie odbijać się o klucz główny: z „lubię"
    // na „nie moja bajka" i odwrotnie to jeden ruch.
    .onConflictDoUpdate({ target: [schema.likedAlbums.userId, schema.likedAlbums.mbid], set: { note: a.note ?? null, kind } });
}
export async function unlikeAlbum(userId: string, mbid: string) {
  await db.delete(schema.likedAlbums).where(and(eq(schema.likedAlbums.userId, userId), eq(schema.likedAlbums.mbid, mbid)));
}

export async function getFavoriteArtists(userId: string, kind: Sentiment = "like") {
  return db
    .select()
    .from(schema.favoriteArtists)
    .where(and(eq(schema.favoriteArtists.userId, userId), eq(schema.favoriteArtists.kind, kind)))
    .orderBy(asc(schema.favoriteArtists.name));
}
export async function artistSentiment(userId: string, mbid: string): Promise<Sentiment | null> {
  const row = await db.query.favoriteArtists.findFirst({
    where: and(eq(schema.favoriteArtists.userId, userId), eq(schema.favoriteArtists.mbid, mbid)),
    columns: { kind: true },
  });
  return row?.kind ?? null;
}
export async function isFavorite(userId: string, mbid: string) {
  return (await artistSentiment(userId, mbid)) === "like";
}
export async function favoriteArtist(userId: string, mbid: string, name: string, kind: Sentiment = "like") {
  await db
    .insert(schema.favoriteArtists)
    .values({ userId, mbid, name, kind })
    .onConflictDoUpdate({ target: [schema.favoriteArtists.userId, schema.favoriteArtists.mbid], set: { kind, name } });
}
export async function unfavoriteArtist(userId: string, mbid: string) {
  await db.delete(schema.favoriteArtists).where(and(eq(schema.favoriteArtists.userId, userId), eq(schema.favoriteArtists.mbid, mbid)));
}

/** Ile osób lubi płytę / ma artystę w ulubionych. */
export async function likeCount(mbid: string) {
  const [r] = await db
    .select({ n: count() })
    .from(schema.likedAlbums)
    .where(and(eq(schema.likedAlbums.mbid, mbid), eq(schema.likedAlbums.kind, "like")));
  return Number(r?.n ?? 0);
}
export async function favoriteCount(mbid: string) {
  const [r] = await db
    .select({ n: count() })
    .from(schema.favoriteArtists)
    .where(and(eq(schema.favoriteArtists.mbid, mbid), eq(schema.favoriteArtists.kind, "like")));
  return Number(r?.n ?? 0);
}

export async function myRatings(userId: string, type: Target) {
  return db.select().from(schema.ratings).where(and(eq(schema.ratings.userId, userId), eq(schema.ratings.targetType, type))).orderBy(desc(schema.ratings.updatedAt));
}

// ---------- Obszary koncertowe ----------

export type AreaScope = "genres" | "favorites";

/** Obszary użytkownika dla jednej z dwóch list (gatunki / ulubieni). */
export async function getAreas(userId: string, scope?: AreaScope) {
  const where = scope
    ? and(eq(schema.userAreas.userId, userId), eq(schema.userAreas.scope, scope))
    : eq(schema.userAreas.userId, userId);
  const rows = await db.select().from(schema.userAreas).where(where).orderBy(asc(schema.userAreas.country), asc(schema.userAreas.city));
  // W bazie "" znaczy „cały kraj"; na zewnątrz wygodniejszy jest null.
  return rows.map((r) => ({ ...r, city: r.city || null }));
}

export async function addArea(userId: string, scope: AreaScope, country: string, city: string | null) {
  const c = country.trim().toUpperCase().slice(0, 2);
  if (!/^[A-Z]{2}$/.test(c)) return;
  const town = city?.trim().slice(0, 80) || "";
  await db.insert(schema.userAreas).values({ userId, scope, country: c, city: town }).onConflictDoNothing();
}

export async function removeArea(userId: string, scope: AreaScope, country: string, city: string | null) {
  await db
    .delete(schema.userAreas)
    .where(
      and(
        eq(schema.userAreas.userId, userId),
        eq(schema.userAreas.scope, scope),
        eq(schema.userAreas.country, country),
        eq(schema.userAreas.city, city ?? ""),
      ),
    );
}

// ---------- język interfejsu ----------

/** Język zapisany w profilu; null = użytkownik nic nie wybierał. */
export async function getUserLocale(userId: string): Promise<string | null> {
  const row = await db.query.users.findFirst({ where: eq(schema.users.id, userId), columns: { locale: true } });
  return row?.locale ?? null;
}

export async function setUserLocale(userId: string, locale: string) {
  await db.update(schema.users).set({ locale }).where(eq(schema.users.id, userId));
}

// ---------- statystyki ----------

/** Ilu ludzi ma konto w portalu. */
export async function usersCount(): Promise<number> {
  const [row] = await db.select({ n: count() }).from(schema.users);
  return Number(row?.n ?? 0);
}

// ---------- listy użytkowników ----------

/** Na listę wchodzi też koncert — patrz komentarz przy `listTarget` w schemacie. */
export type ListTarget = "ALBUM" | "ARTIST" | "CONCERT";

export interface ListItem {
  targetType: ListTarget;
  targetMbid: string;
  label: string;
  note: string | null;
  position: number;
}

/** Listy, które ktoś prowadzi — od ostatnio ruszanej. */
export async function getMyLists(userId: string) {
  const rows = await db
    .select({
      id: schema.lists.id,
      title: schema.lists.title,
      description: schema.lists.description,
      updatedAt: schema.lists.updatedAt,
      items: count(schema.listItems.targetMbid),
    })
    .from(schema.lists)
    .leftJoin(schema.listItems, eq(schema.listItems.listId, schema.lists.id))
    .where(eq(schema.lists.userId, userId))
    .groupBy(schema.lists.id)
    .orderBy(desc(schema.lists.updatedAt));
  return rows.map((r) => ({ ...r, items: Number(r.items) }));
}

export async function getList(id: string) {
  const list = await db.query.lists.findFirst({ where: eq(schema.lists.id, id) });
  if (!list) return null;
  const items = await db
    .select()
    .from(schema.listItems)
    .where(eq(schema.listItems.listId, id))
    .orderBy(asc(schema.listItems.position), asc(schema.listItems.createdAt));
  return { list, items };
}

export async function createList(userId: string, title: string, description?: string | null) {
  const [row] = await db
    .insert(schema.lists)
    .values({ userId, title: title.slice(0, 200), description: description?.slice(0, 2000) ?? null })
    .returning();
  return row;
}

export async function deleteList(userId: string, id: string) {
  await db.delete(schema.lists).where(and(eq(schema.lists.id, id), eq(schema.lists.userId, userId)));
}

/** Dopisanie pozycji. Nowa ląduje na końcu — kolejność na liście jest treścią. */
export async function addToList(
  userId: string,
  listId: string,
  item: { targetType: ListTarget; targetMbid: string; label: string; note?: string | null; url?: string | null },
) {
  const owner = await db.query.lists.findFirst({ where: and(eq(schema.lists.id, listId), eq(schema.lists.userId, userId)) });
  if (!owner) return false;
  const [last] = await db
    .select({ p: sql<number>`coalesce(max(${schema.listItems.position}), 0)` })
    .from(schema.listItems)
    .where(eq(schema.listItems.listId, listId));
  await db
    .insert(schema.listItems)
    .values({ listId, ...item, note: item.note ?? null, url: item.url ?? null, position: Number(last?.p ?? 0) + 1 })
    .onConflictDoUpdate({
      target: [schema.listItems.listId, schema.listItems.targetType, schema.listItems.targetMbid],
      set: { note: item.note ?? null },
    });
  await db.update(schema.lists).set({ updatedAt: new Date() }).where(eq(schema.lists.id, listId));
  return true;
}

export async function removeFromList(userId: string, listId: string, targetType: ListTarget, targetMbid: string) {
  const owner = await db.query.lists.findFirst({ where: and(eq(schema.lists.id, listId), eq(schema.lists.userId, userId)) });
  if (!owner) return;
  await db
    .delete(schema.listItems)
    .where(
      and(
        eq(schema.listItems.listId, listId),
        eq(schema.listItems.targetType, targetType),
        eq(schema.listItems.targetMbid, targetMbid),
      ),
    );
}

/** Na której z moich list to już jest — do podpowiedzi przy przycisku. */
export async function listsWith(userId: string, targetType: ListTarget, targetMbid: string): Promise<string[]> {
  const rows = await db
    .select({ id: schema.lists.id })
    .from(schema.listItems)
    .innerJoin(schema.lists, eq(schema.lists.id, schema.listItems.listId))
    .where(
      and(
        eq(schema.lists.userId, userId),
        eq(schema.listItems.targetType, targetType),
        eq(schema.listItems.targetMbid, targetMbid),
      ),
    );
  return rows.map((r) => r.id);
}

/**
 * Ludzie, którym można polecić listę. Świadomie BEZ adresów e-mail — do wskazania
 * odbiorcy wystarczy nazwa, a adres to nie nasza rzecz do pokazywania.
 */
export async function otherUsers(userId: string) {
  const rows = await db
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
    .from(schema.users)
    .orderBy(asc(schema.users.name));
  return rows
    .filter((u) => u.id !== userId)
    .map((u) => ({ id: u.id, name: u.name || u.email.split("@")[0] }));
}

export async function shareList(userId: string, listId: string, toUserIds: string[], note?: string | null) {
  const owner = await db.query.lists.findFirst({ where: and(eq(schema.lists.id, listId), eq(schema.lists.userId, userId)) });
  if (!owner || !toUserIds.length) return;
  for (const toUserId of toUserIds) {
    if (toUserId === userId) continue;
    await db
      .insert(schema.listShares)
      .values({ listId, toUserId, note: note?.slice(0, 500) ?? null })
      // Ponowne polecenie odświeża notkę i wyciąga listę z powrotem na wierzch.
      .onConflictDoUpdate({
        target: [schema.listShares.listId, schema.listShares.toUserId],
        set: { note: note?.slice(0, 500) ?? null, dismissedAt: null, createdAt: new Date() },
      });
  }
}

/** Komu już poleciłem tę listę. */
export async function sharedWith(listId: string) {
  return db
    .select({ userId: schema.listShares.toUserId, dismissedAt: schema.listShares.dismissedAt })
    .from(schema.listShares)
    .where(eq(schema.listShares.listId, listId));
}

/** Listy polecone mnie — z nazwiskiem polecającego. */
export async function listsForMe(userId: string, includeDismissed = false) {
  const rows = await db
    .select({
      id: schema.lists.id,
      title: schema.lists.title,
      description: schema.lists.description,
      note: schema.listShares.note,
      createdAt: schema.listShares.createdAt,
      dismissedAt: schema.listShares.dismissedAt,
      fromName: schema.users.name,
      fromEmail: schema.users.email,
      items: count(schema.listItems.targetMbid),
    })
    .from(schema.listShares)
    .innerJoin(schema.lists, eq(schema.lists.id, schema.listShares.listId))
    .innerJoin(schema.users, eq(schema.users.id, schema.lists.userId))
    .leftJoin(schema.listItems, eq(schema.listItems.listId, schema.lists.id))
    .where(
      includeDismissed
        ? eq(schema.listShares.toUserId, userId)
        : and(eq(schema.listShares.toUserId, userId), isNull(schema.listShares.dismissedAt)),
    )
    .groupBy(schema.lists.id, schema.listShares.note, schema.listShares.createdAt, schema.listShares.dismissedAt, schema.users.name, schema.users.email)
    .orderBy(desc(schema.listShares.createdAt));
  return rows.map((r) => ({ ...r, items: Number(r.items), from: r.fromName || r.fromEmail.split("@")[0] }));
}

export async function dismissShare(userId: string, listId: string) {
  await db
    .update(schema.listShares)
    .set({ dismissedAt: new Date() })
    .where(and(eq(schema.listShares.listId, listId), eq(schema.listShares.toUserId, userId)));
}

/** Czy wolno mi tę listę oglądać: moja albo mnie polecona. */
export async function canSeeList(userId: string | null, listId: string, ownerId: string) {
  if (userId && userId === ownerId) return true;
  if (!userId) return false;
  const share = await db.query.listShares.findFirst({
    where: and(eq(schema.listShares.listId, listId), eq(schema.listShares.toUserId, userId)),
  });
  return !!share;
}
