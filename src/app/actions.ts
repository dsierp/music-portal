"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
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
  // Ocena znaczy, że tego słuchał — odhaczamy na wszystkich jego podróżach.
  if (score !== null) await ud.markVisitedEverywhere(u.id, t, id).catch(() => {});
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
  await ud.markVisitedEverywhere(u.id, "ALBUM", id).catch(() => {});
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
  await ud.markVisitedEverywhere(u.id, "ARTIST", id).catch(() => {});
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

// ---------- listy użytkowników ----------

/**
 * Dodanie do listy. `listId` puste = nowa lista o nazwie z pola „newList" —
 * dzięki temu z poziomu płyty da się założyć listę jednym ruchem, bez skoku
 * do osobnego ekranu i z powrotem.
 */
const listTarget = z.enum(["ALBUM", "ARTIST", "CONCERT"]);

export async function addToListAction(formData: FormData) {
  const u = await requireUser();
  const type = listTarget.parse(formData.get("type"));
  // Koncert nie ma MBID-u (bywa z Ticketmastera), więc UUID sprawdzamy tylko
  // tam, gdzie faktycznie jest wymagany.
  const id = type === "CONCERT" ? String(formData.get("mbid") ?? "").slice(0, 120) : mbid.parse(formData.get("mbid"));
  if (!id) return;
  const label = String(formData.get("label") ?? "").slice(0, 300);
  let listId = String(formData.get("listId") ?? "");
  const nowa = String(formData.get("newList") ?? "").trim();
  if (!listId && nowa) listId = (await ud.createList(u.id, nowa)).id;
  if (!listId) return;
  await ud.addToList(u.id, listId, {
    targetType: type,
    targetMbid: id,
    label,
    url: String(formData.get("url") ?? "") || null,
  });
  if (type !== "CONCERT") revalidatePath(pathFor(type, id));
  else revalidatePath("/koncerty");
  revalidatePath(`/podroz/${listId}`);
  revalidatePath("/podroze");
}

export async function removeFromListAction(formData: FormData) {
  const u = await requireUser();
  const listId = String(formData.get("listId") ?? "");
  await ud.removeFromList(u.id, listId, listTarget.parse(formData.get("type")), String(formData.get("mbid") ?? ""));
  revalidatePath(`/podroz/${listId}`);
}

export async function createListAction(formData: FormData) {
  const u = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const list = await ud.createList(u.id, title, String(formData.get("description") ?? "") || null);
  revalidatePath("/podroze");
  redirect(`/podroz/${list.id}`);
}

export async function deleteListAction(formData: FormData) {
  const u = await requireUser();
  await ud.deleteList(u.id, String(formData.get("listId") ?? ""));
  revalidatePath("/podroze");
  redirect("/podroze");
}

/** Polecenie listy — wielu naraz, bo zwykle poleca się tym samym ludziom. */
export async function shareListAction(formData: FormData) {
  const u = await requireUser();
  const listId = String(formData.get("listId") ?? "");
  const to = formData.getAll("to").map(String).filter(Boolean);
  await ud.shareList(u.id, listId, to, String(formData.get("note") ?? "") || null);
  revalidatePath(`/podroz/${listId}`);
  revalidatePath("/podroze");
}

export async function dismissShareAction(formData: FormData) {
  const u = await requireUser();
  await ud.dismissShare(u.id, String(formData.get("listId") ?? ""));
  revalidatePath("/podroze");
  revalidatePath("/ja");
}

// ---------- odhaczanie przystanków ----------

/**
 * Ręczne „to już znam" — dla tych, którzy słuchali gdzie indziej niż przez
 * portal. Reszta odhacza się sama: przy ocenie i przy wejściu w Spotify/Tidal.
 */
export async function toggleVisitAction(formData: FormData) {
  const u = await requireUser();
  const listId = String(formData.get("listId") ?? "");
  const type = listTarget.parse(formData.get("type"));
  const id = String(formData.get("mbid") ?? "");
  if (!listId || !id) return;
  if (String(formData.get("current")) === "1") await ud.unmarkVisited(u.id, listId, type, id);
  else await ud.markVisited(u.id, listId, type, id, "manual");
  revalidatePath(`/podroz/${listId}`);
}

// ---------- Spotify ----------

export async function connectSpotify(callbackUrl = "/ja") {
  await signIn("spotify", { redirectTo: callbackUrl });
}

/**
 * Podróż jako prywatna playlista. Zespoły i koncerty zostają poza nią —
 * playlista Spotify to utwory — więc wynik mówi wprost, co nie weszło.
 */
export async function sendJourneyToSpotify(formData: FormData) {
  const u = await requireUser();
  const listId = String(formData.get("listId") ?? "");
  const dane = await ud.getList(listId);
  if (!dane || dane.list.userId !== u.id) return;
  const { journeyToPlaylist } = await import("@/lib/spotify");
  const wynik = await journeyToPlaylist(
    u.id,
    { title: dane.list.title, description: dane.list.description },
    dane.items.map((i) => ({ targetType: i.targetType, label: i.label })),
  ).catch(() => null);
  const q = new URLSearchParams();
  if (!wynik) q.set("spotify", "blad");
  else {
    q.set("spotify", wynik.dodane ? "ok" : "pusto");
    q.set("n", String(wynik.dodane));
    q.set("pominieto", String(wynik.pominiete.length));
    if (wynik.url) q.set("url", wynik.url);
  }
  revalidatePath(`/podroz/${listId}`);
  redirect(`/podroz/${listId}?${q.toString()}`);
}

/**
 * Podróż z piątkowych premier — jednym kliknięciem.
 *
 * Bierzemy DOKŁADNIE to, co widać na ekranie: ten sam tydzień i ten sam filtr
 * gatunków, gwiazdek i wznowień. Podróż ma być zapisem tego, co człowiek
 * właśnie ogląda — a nie osobnym wyborem, który robi za niego portal.
 *
 * Odpadają tylko pozycje bez rozwiązanego MBID-u: nie mają u nas strony, więc
 * byłyby ślepym przystankiem.
 */
export async function journeyFromReleases(formData: FormData) {
  const u = await requireUser();
  const sectionId = String(formData.get("sectionId") ?? "");
  const tytul = String(formData.get("title") ?? "").slice(0, 200) || "Premiery";
  if (!sectionId) return;

  const { releasesFor, splitDb } = await import("@/lib/lists");
  const gatunki = String(formData.get("genres") ?? "").split(",").filter(Boolean);
  const tylkoGwiazdki = String(formData.get("star") ?? "") === "1";
  const zeWznowieniami = String(formData.get("re") ?? "") === "1";

  const wszystkie = await releasesFor([sectionId]);
  // Ten sam warunek, co przy wyświetlaniu listy — inaczej podróż nie zgadzałaby
  // się z tym, co widać.
  const wybrane = wszystkie.filter((r) => {
    if (gatunki.length && !gatunki.includes(splitDb(r.genre, r.description))) return false;
    if (tylkoGwiazdki && r.star !== 1) return false;
    if (!zeWznowieniami && r.flag && ["comp", "reissue", "live", "ep"].includes(r.flag)) return false;
    return !!r.mbid;
  });
  if (!wybrane.length) return;

  const lista = await ud.createList(u.id, tytul, null);
  for (const r of wybrane) {
    await ud
      .addToList(u.id, lista.id, {
        targetType: "ALBUM",
        targetMbid: r.mbid!,
        label: `${r.artist ?? ""} – ${r.album ?? ""}`.trim(),
      })
      .catch(() => {});
  }
  revalidatePath("/podroze");
  redirect(`/podroz/${lista.id}`);
}


/**
 * „Podróż w nieznane": zdanie → zadanie w tle → ekran czekania.
 *
 * Tu dzieje się wyłącznie to, co szybkie: sprawdzenie opisu, klucza i limitu.
 * Samo układanie (model + MusicBrainz, około pół minuty) idzie w tle, bo
 * wcześniej ginęło przy każdym odejściu od ekranu — patrz podroz-zadanie.ts.
 */
export async function podrozWNieznane(_prev: unknown, formData: FormData): Promise<{ blad?: string; szczegol?: string }> {
  const u = await requireUser();
  const opis = String(formData.get("opis") ?? "").trim().slice(0, 2000);
  if (opis.length < 10) return { blad: "krotki" };

  const { aiSkonfigurowane } = await import("@/lib/ai");
  if (!aiSkonfigurowane()) return { blad: "brakKlucza" };

  // Limit dzienny. To jedyne miejsce w portalu, które kosztuje właściciela
  // pieniądze przy każdym kliknięciu — bez tego jedna osoba może wydać cudze
  // saldo, klikając w kółko.
  const { licznikDzienny } = await import("@/lib/cache");
  const LIMIT = Number(process.env.PODROZE_DZIENNIE || 5);
  if ((await licznikDzienny(u.id, "nieznane")) >= LIMIT) return { blad: "limit", szczegol: String(LIMIT) };

  const { zacznijPodroz } = await import("@/lib/podroz-zadanie");
  const id = await zacznijPodroz(u.id, opis);
  redirect(`/podroze/nieznane/${id}`);
}


// ---------- rozmowa o muzyce ----------

/**
 * Wiadomość w rozmowie. Tu dzieje się tylko to, co szybkie: sprawdzenie
 * tekstu, klucza i limitu. Sama odpowiedź (model + MusicBrainz) leci w tle,
 * bo trwa kilkanaście sekund i nie ma prawa zginąć, gdy ktoś odejdzie od
 * ekranu — patrz rozmowa.ts.
 */
export async function powiedzCos(_prev: unknown, formData: FormData): Promise<{ blad?: string; szczegol?: string }> {
  const u = await requireUser();
  const tekst = String(formData.get("tekst") ?? "").trim().slice(0, 2000);
  const id = String(formData.get("id") ?? "") || undefined;
  if (tekst.length < 3) return { blad: "krotki" };

  const { aiSkonfigurowane } = await import("@/lib/ai");
  if (!aiSkonfigurowane()) return { blad: "brakKlucza" };

  // Limit dzienny liczymy w TURACH, nie w rozmowach: każda tura woła model,
  // więc to ona kosztuje. Liczba jest hojniejsza niż przy podróżach, bo
  // rozmowa z natury składa się z kilku pytań.
  const { licznikDzienny, podbijLicznik } = await import("@/lib/cache");
  const LIMIT = Number(process.env.ROZMOWY_DZIENNIE || 30);
  if ((await licznikDzienny(u.id, "rozmowa")) >= LIMIT) return { blad: "limit", szczegol: String(LIMIT) };
  await podbijLicznik(u.id, "rozmowa");

  const { powiedz } = await import("@/lib/rozmowa");
  const nowy = await powiedz(u.id, tekst, id);
  redirect(`/rozmowa/${nowy}`);
}

/**
 * Podróż z rozmowy — dopiero TU powstaje lista.
 *
 * O to chodziło w całym tym ekranie: wynik modelu jest najpierw szukaniem,
 * które da się pooglądać i podrążyć, a zapisaną podróżą staje się dopiero
 * wtedy, gdy człowiek uzna, że warto. Odwrotna kolejność (najpierw lista)
 * robiła podróż z pierwszej lepszej odpowiedzi.
 */
export async function podrozZRozmowy(formData: FormData) {
  const u = await requireUser();
  const id = String(formData.get("id") ?? "");
  const { wczytajRozmowe, plytyZRozmowy } = await import("@/lib/rozmowa");
  const r = await wczytajRozmowe(id);
  if (!r || r.userId !== u.id) redirect("/rozmowa");
  const plyty = plytyZRozmowy(r);
  if (!plyty.length) redirect(`/rozmowa/${id}`);

  const lista = await ud.createList(u.id, r.tytul, r.wiadomosci.find((w) => w.rola === "ja")?.tekst ?? null);
  for (const p of plyty) {
    await ud
      .addToList(u.id, lista.id, {
        targetType: "ALBUM",
        targetMbid: p.album.mbid,
        label: `${p.album.artistText} – ${p.album.title}`.trim(),
        note: p.why || null,
      })
      .catch(() => {});
  }
  revalidatePath("/podroze");
  redirect(`/podroz/${lista.id}`);
}
