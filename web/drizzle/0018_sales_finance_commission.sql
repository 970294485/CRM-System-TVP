ALTER TABLE "sales_contracts" ADD COLUMN IF NOT EXISTS "owner_user_id" uuid;
--> statement-breakpoint
ALTER TABLE "sales_contracts" ADD COLUMN IF NOT EXISTS "commission_rate_percent" numeric(5, 2);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sales_contracts_owner_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "sales_contracts" ADD CONSTRAINT "sales_contracts_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sales_commission_accruals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"beneficiary_user_id" uuid NOT NULL,
	"basis" text NOT NULL,
	"rate_percent" numeric(5, 2) NOT NULL,
	"base_amount" numeric(12, 2) NOT NULL,
	"commission_amount" numeric(12, 2) NOT NULL,
	"advance_receipt_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_commission_accruals_basis_check" CHECK ("sales_commission_accruals"."basis" IN ('advance_receipt'))
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sales_commission_accruals_contract_id_sales_contracts_id_fk'
  ) THEN
    ALTER TABLE "sales_commission_accruals" ADD CONSTRAINT "sales_commission_accruals_contract_id_sales_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."sales_contracts"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sales_commission_accruals_beneficiary_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "sales_commission_accruals" ADD CONSTRAINT "sales_commission_accruals_beneficiary_user_id_users_id_fk" FOREIGN KEY ("beneficiary_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sales_commission_accruals_advance_receipt_id_finance_ar_advance_receipts_id_fk'
  ) THEN
    ALTER TABLE "sales_commission_accruals" ADD CONSTRAINT "sales_commission_accruals_advance_receipt_id_finance_ar_advance_receipts_id_fk" FOREIGN KEY ("advance_receipt_id") REFERENCES "public"."finance_ar_advance_receipts"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sales_commission_accruals_adv_rcpt_uidx" ON "sales_commission_accruals" USING btree ("advance_receipt_id") WHERE "sales_commission_accruals"."advance_receipt_id" IS NOT NULL;
