-- Nowy typ przystanku: RECORDING (pojedynczy utwór).
--
-- NIE robimy tego przez `ALTER TYPE ... ADD VALUE`, choć drizzle-kit tak
-- wygenerował. Ta instrukcja wywala PGlite (lokalna baza deweloperska pada
-- z „Aborted()"), a na Postgresie bywa odmawiana wewnątrz transakcji —
-- a migracje lecą w transakcji. Przebudowanie typu działa wszędzie tak samo:
-- kolumny na tekst, typ od nowa, kolumny z powrotem.
ALTER TABLE "list_item" ALTER COLUMN "target_type" SET DATA TYPE text;
--> statement-breakpoint
ALTER TABLE "list_visit" ALTER COLUMN "target_type" SET DATA TYPE text;
--> statement-breakpoint
DROP TYPE "public"."list_target";
--> statement-breakpoint
CREATE TYPE "public"."list_target" AS ENUM('ALBUM', 'ARTIST', 'CONCERT', 'RECORDING');
--> statement-breakpoint
ALTER TABLE "list_item" ALTER COLUMN "target_type" SET DATA TYPE "public"."list_target" USING "target_type"::"public"."list_target";
--> statement-breakpoint
ALTER TABLE "list_visit" ALTER COLUMN "target_type" SET DATA TYPE "public"."list_target" USING "target_type"::"public"."list_target";
