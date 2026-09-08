CREATE TABLE "user_area" (
	"user_id" text NOT NULL,
	"country" text NOT NULL,
	"city" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_area_user_id_country_city_pk" PRIMARY KEY("user_id","country","city")
);
--> statement-breakpoint
ALTER TABLE "user_area" ADD CONSTRAINT "user_area_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;