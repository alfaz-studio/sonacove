ALTER TABLE "sonacove"."subscription_items" RENAME TO "paddle_subscription_items";--> statement-breakpoint
ALTER TABLE "sonacove"."subscriptions" RENAME TO "paddle_subscriptions";--> statement-breakpoint
ALTER TABLE "sonacove"."paddle_subscriptions" DROP CONSTRAINT "subscriptions_paddle_subscription_id_unique";--> statement-breakpoint
ALTER TABLE "sonacove"."paddle_subscription_items" DROP CONSTRAINT "subscription_items_subscription_id_subscriptions_id_fk";
--> statement-breakpoint
ALTER TABLE "sonacove"."paddle_subscriptions" DROP CONSTRAINT "subscriptions_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "sonacove"."paddle_subscriptions" DROP CONSTRAINT "subscriptions_org_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "sonacove"."paddle_subscription_items" ADD CONSTRAINT "paddle_subscription_items_subscription_id_paddle_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "sonacove"."paddle_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sonacove"."paddle_subscriptions" ADD CONSTRAINT "paddle_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "sonacove"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sonacove"."paddle_subscriptions" ADD CONSTRAINT "paddle_subscriptions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "sonacove"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sonacove"."paddle_subscriptions" ADD CONSTRAINT "paddle_subscriptions_paddle_subscription_id_unique" UNIQUE("paddle_subscription_id");