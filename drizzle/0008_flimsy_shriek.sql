ALTER TABLE "sonacove"."paddle_businesses" DROP CONSTRAINT "paddle_businesses_org_id_unique";--> statement-breakpoint
ALTER TABLE "sonacove"."paddle_businesses" DROP CONSTRAINT "paddle_businesses_org_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "sonacove"."paddle_businesses" DROP COLUMN "org_id";