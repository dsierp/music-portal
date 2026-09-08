"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser, signIn, signOut } from "@/lib/auth";
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

export async function toggleLike(formData: FormData) {
  const u = await requireUser();
  const id = mbid.parse(formData.get("mbid"));
  if (formData.get("liked") === "1") await ud.unlikeAlbum(u.id, id);
  else
    await ud.likeAlbum(u.id, {
      mbid: id,
      title: String(formData.get("title") ?? ""),
      artistName: String(formData.get("artistName") ?? ""),
      artistMbid: String(formData.get("artistMbid") || "") || null,
    });
  revalidatePath(`/album/${id}`);
  revalidatePath("/ja");
}

export async function toggleFavorite(formData: FormData) {
  const u = await requireUser();
  const id = mbid.parse(formData.get("mbid"));
  if (formData.get("favorite") === "1") await ud.unfavoriteArtist(u.id, id);
  else await ud.favoriteArtist(u.id, id, String(formData.get("name") ?? ""));
  revalidatePath(`/artist/${id}`);
  revalidatePath("/ja");
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
  const { cookies } = await import("next/headers");
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
