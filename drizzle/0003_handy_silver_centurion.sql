CREATE TYPE "public"."sentiment" AS ENUM('like', 'dislike');--> statement-breakpoint
ALTER TABLE "favorite_artist" ADD COLUMN "kind" "sentiment" DEFAULT 'like' NOT NULL;--> statement-breakpoint
ALTER TABLE "liked_album" ADD COLUMN "kind" "sentiment" DEFAULT 'like' NOT NULL;