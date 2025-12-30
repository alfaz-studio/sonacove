CREATE TABLE "sonacove"."paddle_businesses" (
	"id" serial PRIMARY KEY NOT NULL,
	"paddle_business_id" varchar(255) NOT NULL,
	"paddle_customer_id" varchar(255),
	"org_id" integer NOT NULL,
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
	CONSTRAINT "paddle_businesses_paddle_business_id_unique" UNIQUE("paddle_business_id"),
	CONSTRAINT "paddle_businesses_org_id_unique" UNIQUE("org_id")
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
CREATE TABLE "sonacove"."subscription_items" (
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
CREATE TABLE "sonacove"."subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"paddle_subscription_id" varchar(255) NOT NULL,
	"paddle_customer_id" varchar(255),
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
	CONSTRAINT "subscriptions_paddle_subscription_id_unique" UNIQUE("paddle_subscription_id")
);
--> statement-breakpoint
ALTER TABLE "sonacove"."paddle_businesses" ADD CONSTRAINT "paddle_businesses_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "sonacove"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sonacove"."paddle_customers" ADD CONSTRAINT "paddle_customers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "sonacove"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sonacove"."subscription_items" ADD CONSTRAINT "subscription_items_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "sonacove"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sonacove"."subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "sonacove"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sonacove"."subscriptions" ADD CONSTRAINT "subscriptions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "sonacove"."organizations"("id") ON DELETE set null ON UPDATE no action;