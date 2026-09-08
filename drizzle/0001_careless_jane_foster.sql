CREATE TYPE "public"."area_scope" AS ENUM('genres', 'favorites');--> statement-breakpoint
CREATE TABLE "user_area" (
	"user_id" text NOT NULL,
	"scope" "area_scope" NOT NULL,
	"country" text NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_area_user_id_scope_country_city_pk" PRIMARY KEY("user_id","scope","country","city")
);
--> statement-breakpoint
ALTER TABLE "user_area" ADD CONSTRAINT "user_area_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;