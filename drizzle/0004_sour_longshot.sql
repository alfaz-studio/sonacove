ALTER TABLE "sonacove"."organization_members" ADD COLUMN "status" varchar(20) DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "sonacove"."organization_members" ADD COLUMN "kc_user_id" varchar(255);--> statement-breakpoint
ALTER TABLE "sonacove"."organization_members" ADD COLUMN "invited_email" varchar(255);--> statement-breakpoint
ALTER TABLE "sonacove"."organization_members" ADD COLUMN "invited_at" timestamp with time zone;