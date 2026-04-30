ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "customer_name" text;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "customer_phone" text;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "customer_email" text;--> statement-breakpoint
UPDATE "quotations" q SET "customer_name" = c.name FROM "customers" c WHERE q.customer_id IS NOT NULL AND c.id = q.customer_id AND (q.customer_name IS NULL OR btrim(q.customer_name) = '');--> statement-breakpoint
UPDATE "quotations" SET "customer_name" = '（未填客戶名）' WHERE "customer_name" IS NULL OR btrim("customer_name") = '';--> statement-breakpoint
ALTER TABLE "quotations" ALTER COLUMN "customer_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "quotations" ALTER COLUMN "customer_id" DROP NOT NULL;
