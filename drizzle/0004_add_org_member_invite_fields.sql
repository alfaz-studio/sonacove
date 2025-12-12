-- Add invitation-related fields to organization_members table
ALTER TABLE "sonacove"."organization_members"
  ADD COLUMN IF NOT EXISTS "status" varchar(20) DEFAULT 'active' NOT NULL,
  ADD COLUMN IF NOT EXISTS "kc_user_id" varchar(255),
  ADD COLUMN IF NOT EXISTS "invited_email" varchar(255),
  ADD COLUMN IF NOT EXISTS "invited_at" timestamptz;

-- Update existing rows to have 'active' status if not already set
UPDATE "sonacove"."organization_members"
SET "status" = 'active'
WHERE "status" IS NULL;
