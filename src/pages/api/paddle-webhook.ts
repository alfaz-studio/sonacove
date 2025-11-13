import { KeycloakClient } from "../../lib/modules/keycloak";
import { PaddleClient, type PaddleWebhookData, type PaddleWebhookEvent } from "../../lib/modules/paddle";
import { getLogger, logWrapper } from "../../lib/modules/pino-logger";

import { capturePosthogEvent } from "../../lib/modules/posthog";
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
    logger.error("Error handling Paddle webhook:");
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

    // Process the subscription data and update Keycloak
    let user = undefined;
    if (extractedData.subscription) {
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
