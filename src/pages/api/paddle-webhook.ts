import { KeycloakClient } from "../../lib/modules/keycloak";
import { PaddleClient, type PaddleWebhookData, type PaddleWebhookEvent } from "../../lib/modules/paddle";
import { getLogger, logWrapper } from "../../lib/modules/pino-logger";
import { createDb } from "../../lib/db/drizzle";
import {
  paddleSubscriptions,
  paddleSubscriptionItems,
  paddleCustomers,
  paddleBusinesses,
  users,
  organizations,
} from "../../lib/db/schema";
import { eq } from "drizzle-orm";
import {
  PUBLIC_PADDLE_ORG_MONTHLY_SEAT_PRICE_ID,
  PUBLIC_PADDLE_ORG_ANNUAL_SEAT_PRICE_ID,
} from "astro:env/client";

import type { APIRoute } from "astro";


export const prerender = false;
const logger = getLogger();

export const POST: APIRoute = async (c) => {
  return await logWrapper(c, WorkerHandler)
}

const WorkerHandler: APIRoute = async ({ request, locals }) => {
  try {
    // Get the raw body as text for verification
    const rawBody = await request.text();

    // Get the Paddle-Signature header
    const signatureHeader = request.headers.get("Paddle-Signature");

    if (!signatureHeader) {
      logger.error("Missing Paddle-Signature header");
      return new Response("Missing signature header", { status: 401 });
    }

    // Verify the webhook signature
    const isVerified = await PaddleClient.validateWebhook(rawBody, signatureHeader);
    if (!isVerified) {
      logger.error("Invalid Paddle webhook signature");
      return new Response("Invalid signature", { status: 401 });
    }

    // Parse the body as JSON
    const event = JSON.parse(rawBody) as PaddleWebhookEvent;

    // Check if this is one of the events we want to handle
    const validEventTypes = [
      "transaction.created",
      "subscription.created",
      "transaction.updated",
      "subscription.updated",
      "customer.created",
      "customer.updated",
      "business.created",
      "business.updated",
    ];

    if (!validEventTypes.includes(event.event_type)) {
      logger.info(`Ignoring event type: ${event.event_type}`);
    } else {
      // Process the webhook asynchronously using waitUntil
      locals.runtime.ctx.waitUntil(processWebhookEvent(event, locals.runtime));
    }

    // Return immediately - processing happens in background
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    logger.error(e, "Error handling Paddle webhook:");
    return new Response("Internal server error", { status: 500 });
  }
};

/**
 * Process webhook event asynchronously
 */
async function processWebhookEvent(event: PaddleWebhookEvent, runtime: Runtime["runtime"]) {
  try {
    // Extract the relevant information
    const extractedData = PaddleClient.extractWebhookData(event);

    // Log the extracted data for debugging
    logger.info(extractedData, "Extracted Paddle data:");

    // Process customer events: sync to DB
    if (extractedData.customer) {
      await upsertCustomerFromWebhook(extractedData);
    }

    // Process business events: sync to DB
    if (extractedData.business) {
      await upsertBusinessFromWebhook(extractedData);
    }

    // Process the subscription data: sync to DB and update Keycloak
    let user = undefined;
    if (extractedData.subscription) {
      // Mirror subscription into local DB
      await upsertSubscriptionFromWebhook(extractedData);

      user = await processSubscriptionUpdate(extractedData, runtime);
      // Subscription activation event
      if (event.event_type === "subscription.created" && user) {
        // await capturePosthogEvent({
        //   distinctId: user.id,
        //   event: "subscription_activated"
        // });
      }
    }
    // Handle transaction events for subscription payment
    if (extractedData.transaction) {
      // Try to find the user by subscription_id or customer_id
      const keycloak = new KeycloakClient(runtime);
      const tx = extractedData.transaction;
      // Try by subscription_id first
      if (tx.subscription_id) {
        user = await keycloak.getUser(undefined, tx.subscription_id);
      }
      // Fallback to customer_id if not found
      if (!user && tx.customer_id) {
        const customerDetails = await PaddleClient.fetchCustomer(tx.customer_id);
        if (customerDetails && customerDetails.email) {
          user = await keycloak.getUser(customerDetails.email, undefined);
        }
      }
      // Subscription payment event: only fire for successful payments
      if (event.event_type === "transaction.updated" && user && tx.status === "paid") {
        // await capturePosthogEvent({
        //   distinctId: user.id,
        //   event: "subscription_payment"
        // });
      }
    }

    logger.info(`Successfully processed ${event.event_type} event`);
  } catch (e) {
    logger.error(e, "Error processing webhook event:");
  }
}

/**
 * Check if a price_id corresponds to an org plan
 */
function isOrgPlanPrice(priceId: string): boolean {
  const orgPriceIds = [
    PUBLIC_PADDLE_ORG_MONTHLY_SEAT_PRICE_ID,
    PUBLIC_PADDLE_ORG_ANNUAL_SEAT_PRICE_ID,
  ].filter(Boolean);
  return orgPriceIds.includes(priceId);
}

/**
 * Upsert subscription and paddle_subscription_items from Paddle webhook into local DB.
 * Uses Paddle as source-of-truth and links to users/orgs via paddle_customers.
 */
async function upsertSubscriptionFromWebhook(extractedData: PaddleWebhookData) {
  const sub = extractedData.subscription;
  if (!sub) return;

  try {
    const db = createDb();

    // Derive aggregate quantity from items (seats)
    const totalQuantity =
      sub.items?.reduce((sum, item) => sum + (item.quantity ?? 0), 0) || 1;

    // Determine if this is an org subscription by checking price IDs
    let isOrgSubscription = false;
    if (sub.items && sub.items.length > 0) {
      // Check if any item has an org plan price_id
      isOrgSubscription = sub.items.some((item) => 
        item.price_id && isOrgPlanPrice(item.price_id)
      );
    }

    // Resolve local user/org via paddle_customers and organizations
    let userId: number | null = null;
    let orgId: number | null = null;

    if (sub.customer_id) {
      const [pc] =
        (await db
          .select()
          .from(paddleCustomers)
          .where(eq(paddleCustomers.paddleCustomerId, sub.customer_id))
          .limit(1)) ?? [];

      if (pc?.userId) {
        userId = pc.userId;

        // If this user owns an org, link the subscription to it
        if (isOrgSubscription) {
          const [org] =
            (await db
              .select()
              .from(organizations)
              .where(eq(organizations.ownerUserId, pc.userId))
              .limit(1)) ?? [];

          if (org?.id) {
            orgId = org.id;
          }
        }
      }
    }

    // Upsert into paddle_subscriptions table
    const existing =
      (await db
        .select()
        .from(paddleSubscriptions)
        .where(eq(paddleSubscriptions.paddleSubscriptionId, sub.id))
        .limit(1)) ?? [];

    let subscriptionRowId: number;

    if (existing.length > 0) {
      const current = existing[0];
      await db
        .update(paddleSubscriptions)
        .set({
          paddleCustomerId: sub.customer_id,
          status: sub.status,
          collectionMode: sub.collection_mode,
          quantity: totalQuantity,
          userId: userId ?? current.userId,
          orgId: orgId ?? current.orgId,
          isOrgSubscription:
            typeof current.isOrgSubscription === "boolean"
              ? current.isOrgSubscription
              : isOrgSubscription,
          rawPayload: sub,
          updatedAt: new Date(),
        })
        .where(eq(paddleSubscriptions.id, current.id));
      subscriptionRowId = current.id;
    } else {
      const [inserted] = await db
        .insert(paddleSubscriptions)
        .values({
          paddleSubscriptionId: sub.id,
          paddleCustomerId: sub.customer_id,
          status: sub.status,
          collectionMode: sub.collection_mode,
          quantity: totalQuantity,
          userId,
          orgId,
          isOrgSubscription,
          rawPayload: sub,
        })
        .returning({ id: paddleSubscriptions.id });
      subscriptionRowId = inserted.id;
    }

    // Mirror items into paddle_subscription_items
    if (sub.items && sub.items.length > 0) {
      // Clear previous items
      await db
        .delete(paddleSubscriptionItems)
        .where(eq(paddleSubscriptionItems.subscriptionId, subscriptionRowId));

      // Insert current items
      for (const item of sub.items) {
        await db.insert(paddleSubscriptionItems).values({
          subscriptionId: subscriptionRowId,
          paddlePriceId: item.price_id,
          productType: "org_seats",
          quantity: item.quantity ?? 1,
          rawItem: item,
        });
      }
    }
  } catch (e) {
    logger.error(e, "Error upserting subscription from Paddle webhook:");
  }
}

/**
 * Upsert customer from Paddle webhook into local DB.
 * Uses Paddle as source-of-truth and links to users via email.
 */
async function upsertCustomerFromWebhook(extractedData: PaddleWebhookData) {
  const customer = extractedData.customer;
  if (!customer) return;

  try {
    const db = createDb();

    // Find user by email to link the customer
    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, customer.email))
      .limit(1);

    if (!dbUser) {
      logger.warn(
        `Skipping Paddle customer ${customer.id} (${customer.email}) - no matching user in database`
      );
      return;
    }

    // Check if paddle_customer already exists
    const existing = await db
      .select()
      .from(paddleCustomers)
      .where(eq(paddleCustomers.paddleCustomerId, customer.id))
      .limit(1);

    const customerData = {
      paddleCustomerId: customer.id,
      userId: dbUser.id,
      email: customer.email,
      name: customer.name,
      rawPayload: customer as any,
      updatedAt: new Date(),
    };

    if (existing.length > 0) {
      // Update existing
      await db
        .update(paddleCustomers)
        .set(customerData)
        .where(eq(paddleCustomers.id, existing[0].id));
    } else {
      // Create new
      await db.insert(paddleCustomers).values({
        ...customerData,
        createdAt: new Date(),
      });
    }
  } catch (e) {
    logger.error(e, "Error upserting customer from Paddle webhook:");
  }
}

/**
 * Upsert business from Paddle webhook into local DB.
 * Uses Paddle as source-of-truth and links to customers (which link to users).
 * Businesses are independent payment entities and don't require organizations.
 */
async function upsertBusinessFromWebhook(extractedData: PaddleWebhookData) {
  const business = extractedData.business;
  if (!business || !business.customer_id) return;

  try {
    const db = createDb();

    // Verify the paddle_customer exists (businesses are linked to customers)
    const [paddleCustomer] = await db
      .select()
      .from(paddleCustomers)
      .where(eq(paddleCustomers.paddleCustomerId, business.customer_id))
      .limit(1);

    if (!paddleCustomer) {
      logger.warn(
        `Skipping Paddle business ${business.id} - customer ${business.customer_id} not found in paddle_customers`
      );
      return;
    }

    // Check if paddle_business already exists
    const existing = await db
      .select()
      .from(paddleBusinesses)
      .where(eq(paddleBusinesses.paddleBusinessId, business.id))
      .limit(1);

    const businessData = {
      paddleBusinessId: business.id,
      paddleCustomerId: business.customer_id,
      name: business.name,
      taxId: business.tax_identifier || null,
      country: business.address?.country_code || null,
      city: business.address?.city || null,
      region: business.address?.region || null,
      postalCode: business.address?.postal_code || null,
      addressLine1: business.address?.line1 || null,
      addressLine2: business.address?.line2 || null,
      rawPayload: business as any,
      updatedAt: new Date(),
    };

    if (existing.length > 0) {
      // Update existing
      await db
        .update(paddleBusinesses)
        .set(businessData)
        .where(eq(paddleBusinesses.id, existing[0].id));
    } else {
      // Create new
      await db.insert(paddleBusinesses).values({
        ...businessData,
        createdAt: new Date(),
      });
    }
  } catch (e) {
    logger.error(e, "Error upserting business from Paddle webhook:");
  }
}

/**
 * Process subscription update and update user data in Keycloak
 */
async function processSubscriptionUpdate(extractedData: PaddleWebhookData, runtime: Runtime["runtime"]) {
  try {
    // Get the subscription ID to identify the user
    const subscriptionData = extractedData.subscription;
    const subscriptionId = subscriptionData?.id;
    const occurredAt = extractedData.occurred_at;
    const customerId = subscriptionData?.customer_id;

    if (!subscriptionId || !occurredAt) {
      throw new Error("Missing subscription ID or timestamp");
    }

    const keycloak = new KeycloakClient(runtime);
    // Find the user with this subscription ID
    let user = await keycloak.getUser(undefined, subscriptionId);

    // If no user found by subscription ID and we have a customer ID, try to fetch customer details
    if (!user && customerId) {
      logger.info(
        `No user found with subscription ID: ${subscriptionId}. Trying to fetch customer details...`
      );
      try {
        const customerDetails = await PaddleClient.fetchCustomer(
          customerId
        );
        if (customerDetails && customerDetails.email) {
          // Find user by email
          user = await keycloak.getUser(customerDetails.email, subscriptionId);
          logger.info(
            `User lookup by email ${customerDetails.email}: ${
              user ? "Found" : "Not found"
            }`
          );
        }
      } catch (e) {
        logger.error(e, 'Error fetching customer details:');
      }
    }

    if (!user) {
      logger.info(
        `No user found for subscription ID: ${subscriptionId} or customer ID: ${customerId}`
      );
      return;
    }

    // Check if this update is newer than what we have stored
    if (
      user.attributes &&
      user.attributes.paddle_last_update &&
      user.attributes.paddle_last_update[0]
    ) {
      const lastUpdate = new Date(user.attributes.paddle_last_update[0]);
      const currentUpdate = new Date(occurredAt);

      if (lastUpdate >= currentUpdate) {
        logger.info(`Skipping older or duplicate update for user ${user.id}`);
        return;
      }
    }

    // Update the user attributes with subscription data
    const updatedAttributes = {
      ...user.attributes,
      paddle_subscription_id: [subscriptionId],
      paddle_subscription_status: [subscriptionData.status || ""],
      paddle_last_update: [occurredAt],
      paddle_collection_mode: [subscriptionData.collection_mode || ""],
      paddle_customer_id: [customerId || ""],
      // Store scheduled_change as a string if it exists
      ...(subscriptionData.scheduled_change && {
        paddle_scheduled_change: [
          JSON.stringify(subscriptionData.scheduled_change),
        ],
      }),
      // Map other relevant subscription data
      paddle_product_id:
        subscriptionData.items?.map((item) => item.product_id) || [],
      paddle_price_id:
        subscriptionData.items?.map((item) => item.price_id) || [],
      paddle_quantity:
        subscriptionData.items?.map((item) => item.quantity.toString()) || [],
    };

    // Update the user in Keycloak
    await keycloak.updateUser(user, { attributes: updatedAttributes });

    logger.info(
      `Successfully updated user ${user.id} with subscription data`
    );
    return user;
  } catch (e) {
    logger.error(e, "Error processing subscription update:");
    throw e;
  }
}
