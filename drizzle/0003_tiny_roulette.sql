CREATE TABLE "sonacove"."organization_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" varchar(20) DEFAULT 'teacher' NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"kc_user_id" varchar(255),
	"invited_email" varchar(255),
	"invited_at" timestamp with time zone,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_members_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "organization_members_org_user_unique" UNIQUE("org_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "sonacove"."organizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"kc_org_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"alias" varchar(255) NOT NULL,
	"owner_user_id" integer NOT NULL,
	"domains" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_kc_org_id_unique" UNIQUE("kc_org_id"),
	CONSTRAINT "organizations_alias_unique" UNIQUE("alias")
);
--> statement-breakpoint
CREATE TABLE "sonacove"."paddle_businesses" (
	"id" serial PRIMARY KEY NOT NULL,
	"paddle_business_id" varchar(255) NOT NULL,
	"paddle_customer_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"tax_id" varchar(255),
	"country" varchar(2),
	"city" varchar(255),
	"region" varchar(255),
	"postal_code" varchar(50),
	"address_line_1" varchar(255),
	"address_line_2" varchar(255),
	"raw_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "paddle_businesses_paddle_business_id_unique" UNIQUE("paddle_business_id")
);
--> statement-breakpoint
CREATE TABLE "sonacove"."paddle_customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"paddle_customer_id" varchar(255) NOT NULL,
	"user_id" integer NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255),
	"raw_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "paddle_customers_paddle_customer_id_unique" UNIQUE("paddle_customer_id"),
	CONSTRAINT "paddle_customers_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "sonacove"."paddle_subscription_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" integer NOT NULL,
	"paddle_price_id" varchar(255) NOT NULL,
	"product_type" varchar(50),
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" integer,
	"raw_item" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sonacove"."paddle_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"paddle_subscription_id" varchar(255) NOT NULL,
	"paddle_customer_id" varchar(255) NOT NULL,
	"paddle_business_id" varchar(255),
	"user_id" integer,
	"org_id" integer,
	"is_org_subscription" boolean DEFAULT false NOT NULL,
	"status" varchar(50) NOT NULL,
	"billing_interval" varchar(10),
	"billing_frequency" integer,
	"quantity" integer DEFAULT 1 NOT NULL,
	"currency" varchar(10),
	"unit_price" integer,
	"collection_mode" varchar(20),
	"trial_end_at" timestamp with time zone,
	"next_billed_at" timestamp with time zone,
	"raw_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "paddle_subscriptions_paddle_subscription_id_unique" UNIQUE("paddle_subscription_id")
);
--> statement-breakpoint
ALTER TABLE "sonacove"."organization_members" ADD CONSTRAINT "organization_members_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "sonacove"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sonacove"."organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "sonacove"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sonacove"."organizations" ADD CONSTRAINT "organizations_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "sonacove"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sonacove"."paddle_customers" ADD CONSTRAINT "paddle_customers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "sonacove"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sonacove"."paddle_subscription_items" ADD CONSTRAINT "paddle_subscription_items_subscription_id_paddle_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "sonacove"."paddle_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sonacove"."paddle_subscriptions" ADD CONSTRAINT "paddle_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "sonacove"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sonacove"."paddle_subscriptions" ADD CONSTRAINT "paddle_subscriptions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "sonacove"."organizations"("id") ON DELETE set null ON UPDATE no action;