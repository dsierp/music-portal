CREATE TYPE "public"."target_type" AS ENUM('ALBUM', 'ARTIST');--> statement-breakpoint
CREATE TABLE "account" (
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "account_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE "api_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"json" jsonb NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "best_of_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"year" text NOT NULL,
	"category" text NOT NULL,
	"rank" integer NOT NULL,
	"artist" text NOT NULL,
	"album" text NOT NULL,
	"label" text,
	"genre" text,
	"country" text,
	"released" text,
	"scores" text,
	"why" text,
	"mbid" text,
	"mbid_tried_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "best_of_year" (
	"year" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"sub" text
);
--> statement-breakpoint
CREATE TABLE "comment" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"target_type" "target_type" NOT NULL,
	"target_mbid" text NOT NULL,
	"parent_id" text,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "favorite_artist" (
	"user_id" text NOT NULL,
	"mbid" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "favorite_artist_user_id_mbid_pk" PRIMARY KEY("user_id","mbid")
);
--> statement-breakpoint
CREATE TABLE "liked_album" (
	"user_id" text NOT NULL,
	"mbid" text NOT NULL,
	"title" text NOT NULL,
	"artist_name" text NOT NULL,
	"artist_mbid" text,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "liked_album_user_id_mbid_pk" PRIMARY KEY("user_id","mbid")
);
--> statement-breakpoint
CREATE TABLE "rating" (
	"user_id" text NOT NULL,
	"target_type" "target_type" NOT NULL,
	"target_mbid" text NOT NULL,
	"score" integer NOT NULL,
	"label" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rating_user_id_target_type_target_mbid_pk" PRIMARY KEY("user_id","target_type","target_mbid")
);
--> statement-breakpoint
CREATE TABLE "release_section" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"date" text NOT NULL,
	"sort_date" timestamp NOT NULL,
	"sub" text,
	"pick_id" text,
	"imported_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "release" (
	"id" text PRIMARY KEY NOT NULL,
	"section_id" text NOT NULL,
	"position" integer NOT NULL,
	"genre" text NOT NULL,
	"star" integer NOT NULL,
	"artist" text,
	"album" text,
	"label" text,
	"description" text NOT NULL,
	"reviews" text,
	"flag" text,
	"day_label" text,
	"mbid" text,
	"mbid_tried_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_genre" (
	"user_id" text NOT NULL,
	"genre" text NOT NULL,
	"weight" integer DEFAULT 3 NOT NULL,
	CONSTRAINT "user_genre_user_id_genre_pk" PRIMARY KEY("user_id","genre")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"emailVerified" timestamp,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verificationToken_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorite_artist" ADD CONSTRAINT "favorite_artist_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liked_album" ADD CONSTRAINT "liked_album_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating" ADD CONSTRAINT "rating_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release" ADD CONSTRAINT "release_section_id_release_section_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."release_section"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_genre" ADD CONSTRAINT "user_genre_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "best_of_rank" ON "best_of_entry" USING btree ("year","category","rank");--> statement-breakpoint
CREATE INDEX "best_of_mbid" ON "best_of_entry" USING btree ("mbid");--> statement-breakpoint
CREATE INDEX "comment_target" ON "comment" USING btree ("target_type","target_mbid","created_at");--> statement-breakpoint
CREATE INDEX "favorite_artist_mbid" ON "favorite_artist" USING btree ("mbid");--> statement-breakpoint
CREATE INDEX "liked_album_mbid" ON "liked_album" USING btree ("mbid");--> statement-breakpoint
CREATE INDEX "rating_target" ON "rating" USING btree ("target_type","target_mbid");--> statement-breakpoint
CREATE INDEX "release_section_idx" ON "release" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "release_mbid" ON "release" USING btree ("mbid");