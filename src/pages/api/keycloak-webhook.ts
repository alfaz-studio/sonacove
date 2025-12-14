// import { capturePosthogEvent } from "../../lib/modules/posthog";
import { PaddleClient } from "../../lib/modules/paddle";
import { BrevoClient } from "../../lib/modules/brevo";
import { KeycloakClient } from "../../lib/modules/keycloak";
import { verifyWebhookSignature } from "../../lib/modules/jwt";
import { getLogger, logWrapper } from "../../lib/modules/pino-logger";
import { createDb } from "../../lib/db/drizzle";
import { users } from "../../lib/db/schema";
import { eq } from "drizzle-orm";
import type { APIRoute } from "astro";
import { KC_WEBHOOK_SECRET } from "astro:env/server";


export const prerender = false;
const logger = getLogger();

// Webhook payload from Keycloak
interface KeycloakWebhookEvent {
  id: string;
  time: number;
  realmId: string;
  realmName: string;
  uid: string;
  authDetails: {
    realmId: string;
    clientId: string;
    userId: string;
    ipAddress: string;
    username: string;
    sessionId?: string;
  };
  details: {
    context?: string;
    updated_first_name?: string;
    previous_first_name?: string;
    updated_last_name?: string;
    previous_last_name?: string;
    // Email verification fields
    auth_method?: string;
    token_id?: string;
    action?: string;
    response_type?: string;
    redirect_uri?: string;
    remember_me?: string;
    code_id?: string;
    email?: string;
    response_mode?: string;
    username?: string;
    // Other fields that might be present in different event types
    grant_type?: string;
    refresh_token_type?: string;
    access_token_expiration_time?: string;
    updated_refresh_token_id?: string;
    scope?: string;
    age_of_refresh_token?: string;
    refresh_token_id?: string;
    refresh_token_sub?: string;
    client_auth_method?: string;
  };
  type: string;
}


export const POST: APIRoute = async (c) => {
  return await logWrapper(c, WorkerHandler)
}

const WorkerHandler: APIRoute = async ({ request, locals }) => {
  try {
    // Get the raw body for signature verification
    const rawBody = await request.text();
    
    // Parse JSON with error handling - body validation happens first
    let webhookEvent: KeycloakWebhookEvent;
    try {
      webhookEvent = JSON.parse(rawBody) as KeycloakWebhookEvent;
    } catch (jsonError) {
      logger.error({ error: jsonError }, "Invalid JSON in request body");
      return new Response(JSON.stringify({ error: "Invalid JSON", details: (jsonError as Error)?.message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Verify HMAC-SHA256 signature
    const signature = request.headers.get("x-keycloak-signature");
    const isValid = await verifyWebhookSignature(
      rawBody,
      signature,
      KC_WEBHOOK_SECRET
    );

    if (!isValid) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Process different event types
    switch (webhookEvent.type) {
      case "access.UPDATE_PROFILE": {
        // Initialize Keycloak client to fetch complete user info if needed
        const keycloakClient = new KeycloakClient(locals.runtime);
        const email = webhookEvent.authDetails.username;

        // Get the updated user information from the webhook
        const { updated_first_name, updated_last_name } = webhookEvent.details;

        // Check if we have a partial update (missing first or last name)
        const isPartialUpdate =
          (updated_first_name && !updated_last_name) ||
          (!updated_first_name && updated_last_name);

        // Variables to store the complete user information
        let firstName = updated_first_name;
        let lastName = updated_last_name;
        let fullName = "";

        // If it's a partial update, fetch the complete user info from Keycloak
        if (isPartialUpdate) {
          try {
            logger.info(
              `Partial update detected for ${email}, fetching complete user data`
            );
            let keycloakUser = null;

            try {
              keycloakUser = await keycloakClient.getUser(email);
            } catch (keycloakError) {
              logger.error(`Error connecting to Keycloak: ${keycloakError}`);
              // Fall back to what we have from the webhook
            }

            if (keycloakUser) {
              // If we got the first name from the webhook, use it; otherwise use the one from Keycloak
              firstName = updated_first_name || keycloakUser.firstName;
              // If we got the last name from the webhook, use it; otherwise use the one from Keycloak
              lastName = updated_last_name || keycloakUser.lastName;

              logger.info(
                `Retrieved complete user data: ${firstName} ${lastName}`
              );
            } else {
              logger.warn(
                `Could not find complete user data for ${email}, proceeding with partial update`
              );
            }
          } catch (error) {
            logger.error(`Error in user data lookup: ${error}`);
            // Continue with the partial data we have
          }
        }

        // Construct the full name from the available data
        fullName =
          firstName && lastName
            ? `${firstName} ${lastName}`
            : firstName || lastName || "";

        // Process updates to Paddle and Brevo
        const results = await Promise.allSettled([
          // Update Paddle customer if we have a name
          fullName
            ? PaddleClient.setCustomer({ email, name: fullName })
            : Promise.resolve(null),

          // Update Brevo contact with new name information
          BrevoClient.setContact(
            email,
            {
              ...(firstName && { FIRSTNAME: firstName }),
              ...(lastName && { LASTNAME: lastName }),
            }
          ),
        ]);

        // Check results
        const errors: string[] = [];
        results.forEach((result, index) => {
          if (result.status === "rejected") {
            errors.push(
              `Error ${index === 0 ? "updating Paddle" : "updating Brevo"}: ${
                result.reason
              }`
            );
          }
        });

        if (errors.length > 0) {
          logger.error(errors, "Errors in webhook processing:");
          return new Response(JSON.stringify({ errors: errors }), {
            status: 207,
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: "Profile update processed successfully",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      case "access.VERIFY_EMAIL": {
        // Verify this is an email verification event
        if (webhookEvent.details.action !== "verify-email") {
          return new Response(
            JSON.stringify({
              message: "Ignored non-email-verification event",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        // Process email verification update to Brevo
        const results = await Promise.allSettled([
          BrevoClient.setContact(
            webhookEvent.authDetails.username,
            {
              "DOUBLE_OPT-IN": true, // email is verified
            }
          ),
        ]);

        // Check results
        const errors: string[] = [];
        results.forEach((result, _index) => {
          if (result.status === "rejected") {
            errors.push(`Error updating Brevo: ${result.reason}`);
          }
        });

        if (errors.length > 0) {
          logger.error(errors, "Errors in webhook processing:");
          return new Response(JSON.stringify({ errors: errors }), {
            status: 207,
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: "Email verification processed successfully",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      case "access.LOGIN": {
        logger.info('LOGIN event captured')
        // await capturePosthogEvent({
        //   distinctId: webhookEvent.authDetails.userId,
        //   event: 'user_logged_in'
        // });
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      case "access.REGISTER": {
        logger.info('REGISTER event captured')
        
        const email = webhookEvent.authDetails.username;
        
        // Fallback: Ensure user exists in database even if registration-flow failed
        // This prevents desync between Keycloak and the database
        // Process asynchronously to return response immediately
        locals.runtime.ctx.waitUntil(
          (async () => {
            try {
              const db = createDb();
              
              // Check if user already exists
              const existingUser = await db
                .select()
                .from(users)
                .where(eq(users.email, email))
                .limit(1);
              
              if (existingUser.length === 0) {
                // User doesn't exist in DB, create them as a fallback
                logger.info(`User not found in database for email: ${email}. Creating user as fallback.`);
                
                // Optionally fetch user details from Keycloak for better data
                let firstName: string | undefined;
                let lastName: string | undefined;
                
                try {
                  const keycloakClient = new KeycloakClient(locals.runtime);
                  const keycloakUser = await keycloakClient.getUser(email);
                  if (keycloakUser) {
                    firstName = keycloakUser.firstName;
                    lastName = keycloakUser.lastName;
                    logger.info(`Retrieved user details from Keycloak: ${firstName} ${lastName}`);
                  }
                } catch (keycloakError) {
                  logger.warn(`Could not fetch user details from Keycloak: ${keycloakError}. Proceeding with minimal user creation.`);
                }
                
                // Create new user with minimal required fields
                const [newUser] = await db
                  .insert(users)
                  .values({
                    email: email,
                    isActiveHost: false,
                    maxBookings: 1, // Default to 1 booking
                    totalHostMinutes: 0,
                  })
                  .returning();
                
                logger.info(`Created user in database as fallback with ID: ${newUser.id} for email: ${email}`);
                
                // Optionally update Paddle and Brevo if we have name information
                if (firstName || lastName) {
                  const fullName = firstName && lastName 
                    ? `${firstName} ${lastName}` 
                    : firstName || lastName || "";
                  
                  if (fullName) {
                    await Promise.allSettled([
                      PaddleClient.setCustomer({ email, name: fullName }),
                      BrevoClient.setContact(
                        email,
                        {
                          ...(firstName && { FIRSTNAME: firstName }),
                          ...(lastName && { LASTNAME: lastName }),
                        }
                      ),
                    ]);
                  }
                }
              } else {
                logger.info(`User already exists in database for email: ${email}. No action needed.`);
              }
            } catch (dbError) {
              // Log error but don't fail the webhook - this is a fallback mechanism
              logger.error(dbError, `Failed to create user in database as fallback for email: ${email}`);
            }
            
            // await capturePosthogEvent({
            //   distinctId: webhookEvent.authDetails.userId,
            //   event: 'user_registered',
            // });
          })()
        );
        
        // Return immediately - processing happens in background
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      default:
        return new Response(
          JSON.stringify({ message: "Ignored unsupported event type" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
    }
  } catch (e) {
    logger.error(e, "Error processing Keycloak webhook:");
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};


