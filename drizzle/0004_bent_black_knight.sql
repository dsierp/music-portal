CREATE TYPE "public"."list_target" AS ENUM('ALBUM', 'ARTIST', 'CONCERT');--> statement-breakpoint
CREATE TABLE "list_item" (
	"list_id" text NOT NULL,
	"target_type" "list_target" NOT NULL,
	"target_mbid" text NOT NULL,
	"label" text NOT NULL,
	"note" text,
	"url" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "list_item_list_id_target_type_target_mbid_pk" PRIMARY KEY("list_id","target_type","target_mbid")
);
--> statement-breakpoint
CREATE TABLE "list_share" (
	"list_id" text NOT NULL,
	"to_user_id" text NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"dismissed_at" timestamp,
	CONSTRAINT "list_share_list_id_to_user_id_pk" PRIMARY KEY("list_id","to_user_id")
);
--> statement-breakpoint
CREATE TABLE "list" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "list_item" ADD CONSTRAINT "list_item_list_id_list_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."list"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_share" ADD CONSTRAINT "list_share_list_id_list_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."list"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_share" ADD CONSTRAINT "list_share_to_user_id_user_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list" ADD CONSTRAINT "list_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "list_item_list" ON "list_item" USING btree ("list_id","position");--> statement-breakpoint
CREATE INDEX "list_share_to" ON "list_share" USING btree ("to_user_id","created_at");--> statement-breakpoint
CREATE INDEX "list_user" ON "list" USING btree ("user_id","updated_at");