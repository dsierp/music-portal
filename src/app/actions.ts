"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { cookies } from "next/headers";
import { currentUser, requireUser, signIn, signOut } from "@/lib/auth";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, normalizeLocale } from "@/lib/i18n";
import * as ud from "@/lib/user-data";

const target = z.enum(["ALBUM", "ARTIST"]);
const mbid = z.string().uuid();

function pathFor(type: "ALBUM" | "ARTIST", id: string) {
  return type === "ALBUM" ? `/album/${id}` : `/artist/${id}`;
}

// ---------- logowanie ----------

export async function loginWith(provider: string, callbackUrl = "/") {
  await signIn(provider, { redirectTo: callbackUrl });
}
export async function loginDev(formData: FormData) {
  await signIn("dev", { email: String(formData.get("email") ?? ""), redirectTo: String(formData.get("callbackUrl") || "/") });
}
export async function logout() {
  await signOut({ redirectTo: "/" });
}

// ---------- oceny ----------

export async function rate(formData: FormData) {
  const u = await requireUser();
  const t = target.parse(formData.get("type"));
  const id = mbid.parse(formData.get("mbid"));
  const raw = formData.get("score");
  const score = raw === "" || raw === null ? null : z.coerce.number().int().min(1).max(10).parse(raw);
  await ud.setRating(u.id, t, id, score, String(formData.get("label") ?? "").slice(0, 200) || null);
  revalidatePath(pathFor(t, id));
}

// ---------- komentarze ----------

export async function comment(formData: FormData) {
  const u = await requireUser();
  const t = target.parse(formData.get("type"));
  const id = mbid.parse(formData.get("mbid"));
  const parentId = String(formData.get("parentId") || "") || null;
  await ud.addComment(u.id, t, id, String(formData.get("body") ?? ""), parentId);
  revalidatePath(pathFor(t, id));
}
export async function editCommentAction(formData: FormData) {
  const u = await requireUser();
  const t = target.parse(formData.get("type"));
  const id = mbid.parse(formData.get("mbid"));
  await ud.editComment(u.id, String(formData.get("commentId")), String(formData.get("body") ?? ""));
  revalidatePath(pathFor(t, id));
}
export async function deleteCommentAction(formData: FormData) {
  const u = await requireUser();
  const t = target.parse(formData.get("type"));
  const id = mbid.parse(formData.get("mbid"));
  await ud.deleteComment(u.id, String(formData.get("commentId")));
  revalidatePath(pathFor(t, id));
}

// ---------- ulubione / lubię ----------

/**
 * „Lubię" i „nie moja bajka" na jednym przycisku każdy.
 *
 * `kind` mówi, o który chodzi; kliknięcie w już zaznaczony zdejmuje znak,
 * a kliknięcie w drugi po prostu zmienia zdanie. „Nie lubię" to świadomie NIE
 * ocena 1/10: ocena mówi „to jest słabe", a to mówi „nie mój klimat".
 */
export async function toggleLike(formData: FormData) {
  const u = await requireUser();
  const id = mbid.parse(formData.get("mbid"));
  const kind = formData.get("kind") === "dislike" ? "dislike" : "like";
  const teraz = String(formData.get("current") ?? "");
  if (teraz === kind) await ud.unlikeAlbum(u.id, id);
  else
    await ud.likeAlbum(
      u.id,
      {
        mbid: id,
        title: String(formData.get("title") ?? ""),
        artistName: String(formData.get("artistName") ?? ""),
        artistMbid: String(formData.get("artistMbid") || "") || null,
      },
      kind,
    );
  revalidatePath(`/album/${id}`);
  revalidatePath("/ja");
  // Po odrzuceniu płyty pytamy o artystę — jednym parametrem w adresie, bez
  // okienka. Pytamy tylko wtedy, gdy jest o kogo i gdy sam nie jest jeszcze
  // oznaczony; stronę i tak przeładowujemy.
  const artistMbid = String(formData.get("artistMbid") || "");
  if (kind === "dislike" && teraz !== kind && artistMbid && !(await ud.artistSentiment(u.id, artistMbid))) {
    redirect(`/album/${id}?nielubie=${encodeURIComponent(artistMbid)}`);
  }
}

export async function toggleFavorite(formData: FormData) {
  const u = await requireUser();
  const id = mbid.parse(formData.get("mbid"));
  const kind = formData.get("kind") === "dislike" ? "dislike" : "like";
  const teraz = String(formData.get("current") ?? "");
  if (teraz === kind) await ud.unfavoriteArtist(u.id, id);
  else await ud.favoriteArtist(u.id, id, String(formData.get("name") ?? ""), kind);
  revalidatePath(`/artist/${id}`);
  revalidatePath("/ja");
  const back = String(formData.get("back") ?? "");
  if (back.startsWith("/")) redirect(back);
}

// ---------- preferencje ----------

export async function setGenreAction(formData: FormData) {
  const u = await requireUser();
  const genre = String(formData.get("genre") ?? "");
  const raw = formData.get("weight");
  const weight = raw === "" || raw === null || raw === "0" ? null : z.coerce.number().int().min(1).max(5).parse(raw);
  await ud.setGenre(u.id, genre, weight);
  revalidatePath("/ja");
  revalidatePath("/");
}

export async function addLikedFromSearch(formData: FormData) {
  const u = await requireUser();
  await ud.likeAlbum(u.id, {
    mbid: mbid.parse(formData.get("mbid")),
    title: String(formData.get("title") ?? ""),
    artistName: String(formData.get("artistName") ?? ""),
    artistMbid: String(formData.get("artistMbid") || "") || null,
  });
  revalidatePath("/ja");
  redirect("/ja#plyty");
}

/**
 * „Wybiorę później" na ekranie powitalnym: zapamiętujemy decyzję w ciasteczku
 * (rok), żeby portal nie wracał z tym pytaniem przy każdym wejściu.
 */
export async function skipOnboarding() {
  const { SKIP_ONBOARDING } = await import("@/lib/onboarding");
  (await cookies()).set(SKIP_ONBOARDING, "1", { maxAge: 60 * 60 * 24 * 365, httpOnly: true, sameSite: "lax", path: "/" });
  redirect("/");
}

// ---------- Obszary koncertowe ----------

const scopeOf = (v: FormDataEntryValue | null) => (String(v) === "favorites" ? "favorites" : "genres") as ud.AreaScope;

export async function addAreaAction(formData: FormData) {
  const u = await requireUser();
  await ud.addArea(u.id, scopeOf(formData.get("scope")), String(formData.get("country") ?? ""), String(formData.get("city") ?? "") || null);
  revalidatePath("/ja");
  revalidatePath("/koncerty");
}

export async function removeAreaAction(formData: FormData) {
  const u = await requireUser();
  await ud.removeArea(u.id, scopeOf(formData.get("scope")), String(formData.get("country") ?? ""), String(formData.get("city") ?? "") || null);
  revalidatePath("/ja");
  revalidatePath("/koncerty");
}

// ---------- język ----------

/**
 * Zmiana języka. Ciasteczko działa od razu i także dla niezalogowanych;
 * zalogowanym zapisujemy wybór jeszcze w profilu, żeby szedł za nimi na inne
 * urządzenie. Wracamy na tę samą stronę — adresy są wspólne dla wszystkich
 * języków, więc nie ma dokąd przekierowywać.
 */
export async function setLocaleAction(formData: FormData) {
  const wanted = normalizeLocale(String(formData.get("locale") ?? ""));
  if (!wanted) return;
  (await cookies()).set(LOCALE_COOKIE, wanted, {
    maxAge: LOCALE_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
  });
  const user = await currentUser();
  if (user) await ud.setUserLocale(user.id, wanted).catch(() => {});
  const back = String(formData.get("back") ?? "/");
  revalidatePath(back.startsWith("/") ? back : "/", "layout");
  redirect(back.startsWith("/") ? back : "/");
}
