ALTER TABLE "list" ADD COLUMN "slot" text;--> statement-breakpoint
CREATE UNIQUE INDEX "list_user_slot" ON "list" USING btree ("user_id","slot");