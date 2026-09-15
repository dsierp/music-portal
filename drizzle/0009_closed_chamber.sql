CREATE TYPE "public"."play_source" AS ENUM('spotify', 'klik');--> statement-breakpoint
CREATE TABLE "play" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"artist" text NOT NULL,
	"title" text NOT NULL,
	"album" text,
	"mbid" text,
	"source" "play_source" NOT NULL,
	"played_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "play" ADD CONSTRAINT "play_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "play_user" ON "play" USING btree ("user_id","played_at");