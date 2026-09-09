CREATE TYPE "public"."visit_source" AS ENUM('link', 'rating', 'manual');--> statement-breakpoint
CREATE TABLE "list_visit" (
	"user_id" text NOT NULL,
	"list_id" text NOT NULL,
	"target_type" "list_target" NOT NULL,
	"target_mbid" text NOT NULL,
	"source" "visit_source" DEFAULT 'manual' NOT NULL,
	"visited_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "list_visit_user_id_list_id_target_type_target_mbid_pk" PRIMARY KEY("user_id","list_id","target_type","target_mbid")
);
--> statement-breakpoint
ALTER TABLE "list_visit" ADD CONSTRAINT "list_visit_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_visit" ADD CONSTRAINT "list_visit_list_id_list_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."list"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "list_visit_user" ON "list_visit" USING btree ("user_id","list_id");