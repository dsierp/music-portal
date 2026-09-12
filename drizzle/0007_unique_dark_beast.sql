ALTER TABLE "user" ADD COLUMN "nick" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "discoverable" boolean DEFAULT false NOT NULL;