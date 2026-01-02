import type { APIRoute } from "astro";
import { getEmailFromJWT } from "../../../lib/modules/jwt";
import { KeycloakClient } from "../../../lib/modules/keycloak";
import { PaddleClient } from "../../../lib/modules/paddle";
import { getLogger, logWrapper } from "../../../lib/modules/pino-logger";
import { createDb } from "../../../lib/db/drizzle";
import {
  users,
  organizations,
  organizationMembers,
  paddleSubscriptions,
  paddleSubscriptionItems,
} from "../../../lib/db/schema";
import { and, eq } from "drizzle-orm";
import { resolvePriceId, type BillingInterval } from "../../../utils/paddle";

export const prerender = false;
const logger = getLogger();

export const POST: APIRoute = async (c) => {
  return await logWrapper(c, WorkerHandler);
};

const WorkerHandler: APIRoute = async ({ request, locals }) => {
  try {
    const authHeader = request.headers.get("Authorization");
    const jwt = authHeader?.replace("Bearer ", "");

    if (!jwt) {
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const keycloakClient = new KeycloakClient(locals.runtime);
    const isValidToken = await keycloakClient.validateToken(jwt);
    if (!isValidToken) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const email = getEmailFromJWT(jwt);
    if (!email) {
      return new Response(JSON.stringify({ error: "No email in token" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = (await request.json().catch(() => null)) as
      | {
          subscriptionId?: string;
          quantity?: number;
          prorationBillingMode?: string;
        }
      | null;

    if (!body) {
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { subscriptionId, quantity, prorationBillingMode } = body;

    if (!subscriptionId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: subscriptionId" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (quantity === undefined || quantity === null) {
      return new Response(
        JSON.stringify({ error: "Missing required field: quantity" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (quantity < 1) {
      return new Response(
        JSON.stringify({ error: "Quantity must be at least 1" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (quantity > 500) {
      return new Response(
        JSON.stringify({ error: "Quantity cannot exceed 500" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const db = createDb();
    const [dbUser] =
      (await db.select().from(users).where(eq(users.email, email)).limit(1)) ??
      [];

    if (!dbUser?.id) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Find the subscription
    const [subscription] =
      (await db
        .select()
        .from(paddleSubscriptions)
        .where(
          eq(paddleSubscriptions.paddleSubscriptionId, subscriptionId)
        )
        .limit(1)) ?? [];

    if (!subscription) {
      return new Response(
        JSON.stringify({ error: "Subscription not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Verify user has permission to update this subscription
    // For org subscriptions, user must be the owner of the org
    if (subscription.isOrgSubscription) {
      if (subscription.orgId) {
        // Check if user owns the org
        const [org] =
          (await db
            .select()
            .from(organizations)
            .where(
              and(
                eq(organizations.id, subscription.orgId),
                eq(organizations.ownerUserId, dbUser.id)
              )
            )
            .limit(1)) ?? [];

        if (!org) {
          return new Response(
            JSON.stringify({
              error: "You do not have permission to update this subscription",
            }),
            {
              status: 403,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      } else {
        // Subscription not linked to org yet, check if user owns it
        if (subscription.userId !== dbUser.id) {
          return new Response(
            JSON.stringify({
              error: "You do not have permission to update this subscription",
            }),
            {
              status: 403,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      }
    } else {
      // Individual subscription - user must own it
      if (subscription.userId !== dbUser.id) {
        return new Response(
          JSON.stringify({
            error: "You do not have permission to update this subscription",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Check subscription status
    if (subscription.status !== "active") {
      return new Response(
        JSON.stringify({
          error: "Only active subscriptions can be updated",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Get current subscription items to find the price_id
    const subscriptionItems = await db
      .select()
      .from(paddleSubscriptionItems)
      .where(eq(paddleSubscriptionItems.subscriptionId, subscription.id));

    if (subscriptionItems.length === 0) {
      // If no items in DB, try to get from rawPayload or resolve from billing interval
      let priceId: string | undefined;

      if (subscription.billingInterval) {
        const billingInterval = subscription.billingInterval.toLowerCase() as BillingInterval;
        if (billingInterval === "month" || billingInterval === "year") {
          priceId = resolvePriceId("org", billingInterval);
        }
      }

      if (!priceId) {
        return new Response(
          JSON.stringify({
            error: "Could not determine price ID for subscription",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Update subscription with single item
      const prorationMode =
        (prorationBillingMode as
          | "prorated_immediately"
          | "prorated_next_billing_period"
          | "full_immediately"
          | "full_next_billing_period"
          | "do_not_bill") || "prorated_immediately";

      try {
        await PaddleClient.updateSubscription(
          subscriptionId,
          [{ priceId, quantity }],
          prorationMode
        );

        return new Response(
          JSON.stringify({
            success: true,
            message: "Subscription updated successfully",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      } catch (error) {
        logger.error(error, "Error updating subscription:");
        return new Response(
          JSON.stringify({
            error:
              error instanceof Error
                ? error.message
                : "Failed to update subscription",
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Get the price_id from the first item (org subscriptions typically have one item)
    const priceId = subscriptionItems[0]?.paddlePriceId;

    if (!priceId) {
      return new Response(
        JSON.stringify({
          error: "Could not determine price ID for subscription",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Determine proration mode
    // Default: prorated_immediately for increases, prorated_next_billing_period for decreases
    const currentQuantity = subscription.quantity;
    const isIncrease = quantity > currentQuantity;
    const defaultProrationMode = isIncrease
      ? "prorated_immediately"
      : "prorated_next_billing_period";

    const prorationMode =
      (prorationBillingMode as
        | "prorated_immediately"
        | "prorated_next_billing_period"
        | "full_immediately"
        | "full_next_billing_period"
        | "do_not_bill") || defaultProrationMode;

    // Update subscription via Paddle API
    try {
      await PaddleClient.updateSubscription(
        subscriptionId,
        [{ priceId, quantity }],
        prorationMode
      );

      return new Response(
        JSON.stringify({
          success: true,
          message: "Subscription updated successfully",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      logger.error(error, "Error updating subscription:");
      return new Response(
        JSON.stringify({
          error:
            error instanceof Error
              ? error.message
              : "Failed to update subscription",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  } catch (e) {
    logger.error(e, "Error updating subscription:");
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

