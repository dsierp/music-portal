/**
 * Music Portal — schemat bazy (Drizzle ORM, Postgres).
 * Baza trzyma TYLKO dane użytkowników i cache odpowiedzi z zewnętrznych API.
 * Katalog płyt/artystów nie jest kopiowany — kluczem jest MBID (MusicBrainz ID).
 */
import { relations } from "drizzle-orm";
import { index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

// ---------- Auth.js (tabele wymagane przez @auth/drizzle-adapter) ----------

export const users = pgTable("user", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique().notNull(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

// ---------- Preferencje ----------

/** Styl muzyczny z wagą 1–5 (5 = najważniejszy). */
export const userGenres = pgTable(
  "user_genre",
  {
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    genre: text("genre").notNull(),
    weight: integer("weight").notNull().default(3),
  },
  (t) => [primaryKey({ columns: [t.userId, t.genre] })],
);

/** Płyta, którą użytkownik kazał zapamiętać ("lubię"). mbid = release-group. */
export const likedAlbums = pgTable(
  "liked_album",
  {
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    mbid: text("mbid").notNull(),
    title: text("title").notNull(),
    artistName: text("artist_name").notNull(),
    artistMbid: text("artist_mbid"),
    note: text("note"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.mbid] }), index("liked_album_mbid").on(t.mbid)],
);

export const favoriteArtists = pgTable(
  "favorite_artist",
  {
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    mbid: text("mbid").notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.mbid] }), index("favorite_artist_mbid").on(t.mbid)],
);

/**
 * Obszary, z których użytkownik chce widzieć koncerty.
 *
 * Miasto ALBO cały kraj — dlatego `city` bywa puste. Kod kraju trzymamy zawsze,
 * bo to on identyfikuje rynek („PL", „DE"), a nazwy miast bywają w kilku
 * wariantach (Warszawa/Warsaw) i same w sobie są niejednoznaczne.
 *
 * `scope` to dwie NIEZALEŻNE listy, bo ludzie mają dwa różne apetyty:
 * po ulubiony zespół jedzie się przez pół kraju, a „coś w moich gatunkach"
 * ogląda się w swoim mieście. Stąd np. ulubieni → cała Polska, gatunki →
 * Kraków i Warszawa.
 */
export const areaScope = pgEnum("area_scope", ["genres", "favorites"]);

export const userAreas = pgTable(
  "user_area",
  {
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    scope: areaScope("scope").notNull(),
    country: text("country").notNull(), // ISO-3166-1 alpha-2, np. "PL"
    // Pusty tekst = cały kraj. Świadomie NOT NULL: `city` jest częścią klucza
    // głównego, a NULL w kluczu Postgres odrzuca — więc „brak miasta" musi mieć
    // swoją wartość. Warstwa wyżej (user-data.ts) zamienia "" na null i odwrotnie.
    city: text("city").notNull().default(""),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.scope, t.country, t.city] })],
);

// ---------- Oceny i komentarze ----------

export const targetType = pgEnum("target_type", ["ALBUM", "ARTIST"]);

/** Ocena 1–10 płyty (ALBUM, mbid = release-group) albo artysty (ARTIST). */
export const ratings = pgTable(
  "rating",
  {
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    targetType: targetType("target_type").notNull(),
    targetMbid: text("target_mbid").notNull(),
    score: integer("score").notNull(),
    label: text("label"), // "Artysta – Tytuł" do list "moje oceny" (migawka, nie źródło prawdy)
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.targetType, t.targetMbid] }), index("rating_target").on(t.targetType, t.targetMbid)],
);

export const comments = pgTable(
  "comment",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    targetType: targetType("target_type").notNull(),
    targetMbid: text("target_mbid").notNull(),
    parentId: text("parent_id"),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { mode: "date" }),
  },
  (t) => [index("comment_target").on(t.targetType, t.targetMbid, t.createdAt)],
);

export const commentsRelations = relations(comments, ({ one }) => ({
  user: one(users, { fields: [comments.userId], references: [users.id] }),
}));
export const usersRelations = relations(users, ({ many }) => ({ comments: many(comments) }));

// ---------- Premiery piątkowe (import z Pure New Shit) ----------

export const releaseSections = pgTable("release_section", {
  id: text("id").primaryKey(), // np. "f0904"
  kind: text("kind").notNull(), // friday | week
  title: text("title").notNull(),
  date: text("date").notNull(), // "04.09.2026" | "05.09 – 11.09.2026"
  sortDate: timestamp("sort_date", { mode: "date" }).notNull(),
  sub: text("sub"),
  pickId: text("pick_id"),
  importedAt: timestamp("imported_at", { mode: "date" }).defaultNow().notNull(),
});

export const releases = pgTable(
  "release",
  {
    id: text("id").primaryKey(), // "<sekcja>:<id z pliku>"
    sectionId: text("section_id").notNull().references(() => releaseSections.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    genre: text("genre").notNull(), // db | prog | other | jazz
    star: integer("star").notNull(), // 1 ★, 0 zwykły, -1 zbiorczy "mniejsze"
    artist: text("artist"),
    album: text("album"),
    label: text("label"),
    description: text("description").notNull(), // HTML
    reviews: text("reviews"), // HTML
    flag: text("flag"), // ep | comp | reissue | live | instr
    dayLabel: text("day_label"),
    mbid: text("mbid"), // release-group MBID po rozwiązaniu
    mbidTriedAt: timestamp("mbid_tried_at", { mode: "date" }),
  },
  (t) => [index("release_section_idx").on(t.sectionId), index("release_mbid").on(t.mbid)],
);

export const releasesRelations = relations(releases, ({ one }) => ({
  section: one(releaseSections, { fields: [releases.sectionId], references: [releaseSections.id] }),
}));
export const releaseSectionsRelations = relations(releaseSections, ({ many }) => ({ releases: many(releases) }));

// ---------- Best of ----------

export const bestOfYears = pgTable("best_of_year", {
  year: text("year").primaryKey(),
  label: text("label").notNull(),
  sub: text("sub"),
});

export const bestOfEntries = pgTable(
  "best_of_entry",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    year: text("year").notNull(),
    category: text("category").notNull(), // death | black | other | prog | jazz
    rank: integer("rank").notNull(),
    artist: text("artist").notNull(),
    album: text("album").notNull(),
    label: text("label"),
    genre: text("genre"),
    country: text("country"),
    released: text("released"),
    scores: text("scores"),
    why: text("why"),
    mbid: text("mbid"),
    mbidTriedAt: timestamp("mbid_tried_at", { mode: "date" }),
  },
  (t) => [uniqueIndex("best_of_rank").on(t.year, t.category, t.rank), index("best_of_mbid").on(t.mbid)],
);

// ---------- Cache zewnętrznych API ----------

export const apiCache = pgTable("api_cache", {
  key: text("key").primaryKey(),
  json: jsonb("json").notNull(),
  fetchedAt: timestamp("fetched_at", { mode: "date" }).defaultNow().notNull(),
});
