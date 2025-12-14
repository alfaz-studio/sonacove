CREATE TABLE IF NOT EXISTS "sonacove"."organizations" (
  "id" serial PRIMARY KEY NOT NULL,
  "kc_org_id" varchar(255) NOT NULL,
  "name" varchar(255) NOT NULL,
  "alias" varchar(255) NOT NULL,
  "owner_user_id" integer NOT NULL,
  "domains" jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "organizations_kc_org_id_unique" UNIQUE("kc_org_id"),
  CONSTRAINT "organizations_alias_unique" UNIQUE("alias")
);

ALTER TABLE "sonacove"."organizations"
  ADD CONSTRAINT "organizations_owner_user_id_users_id_fk"
  FOREIGN KEY ("owner_user_id") REFERENCES "sonacove"."users"("id")
  ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE TABLE IF NOT EXISTS "sonacove"."organization_members" (
  "id" serial PRIMARY KEY NOT NULL,
  "org_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "role" varchar(20) DEFAULT 'teacher' NOT NULL,
  "joined_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "organization_members_user_id_unique" UNIQUE("user_id"),
  CONSTRAINT "organization_members_org_user_unique" UNIQUE("org_id","user_id")
);

ALTER TABLE "sonacove"."organization_members"
  ADD CONSTRAINT "organization_members_org_id_organizations_id_fk"
  FOREIGN KEY ("org_id") REFERENCES "sonacove"."organizations"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "sonacove"."organization_members"
  ADD CONSTRAINT "organization_members_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "sonacove"."users"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
