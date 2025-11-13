
import type { APIRoute } from "astro";
import { getLogger, logWrapper } from "../../lib/modules/pino-logger";
import { KeycloakClient } from "../../lib/modules/keycloak";
import { getEmailFromJWT } from "../../lib/modules/jwt";
import { createDb } from "../../lib/db/drizzle";
import { users, bookedRooms } from "../../lib/db/schema";
import { eq } from "drizzle-orm";
import { PaddleClient } from "../../lib/modules/paddle";
import { BrevoClient } from "../../lib/modules/brevo";
import { CF_WEBHOOK_SECRET } from "astro:env/server";

export const prerender = false;
const logger = getLogger();

export const GET: APIRoute = async (c) => {
  return await logWrapper(c, WorkerHandler);
};

export const DELETE: APIRoute = async (c) => {
  return await logWrapper(c, DeleteWorkerHandler);
};

/**
 * GET endpoint that returns the user object along with any booked rooms.
 * Validates the bearer token using KeycloakClient.validateToken,
 * then gets the user from the db using drizzle.
 */
const WorkerHandler: APIRoute = async ({ request, locals }) => {
  try {
    // Extract Bearer token from Authorization header
    const authHeader = request.headers.get("Authorization");
    const bearerToken = authHeader?.replace("Bearer ", "");

    if (!bearerToken) {
      logger.error("Missing Authorization header");
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Validate token using KeycloakClient
    const keycloakClient = new KeycloakClient(locals.runtime);
    const isValidToken = await keycloakClient.validateToken(bearerToken);

    if (!isValidToken) {
      logger.error("Invalid bearer token");
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Extract email from JWT token
    const email = getEmailFromJWT(bearerToken);

    if (!email) {
      logger.error("Could not extract email from JWT token");
      return new Response(JSON.stringify({ error: "Invalid token - no email found" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Create database connection
    const db = createDb();

    // Get user and their booked rooms in a single query using LEFT JOIN
    const userWithBookings = await db
      .select({
        // User fields
        userId: users.id,
        userEmail: users.email,
        isActiveHost: users.isActiveHost,
        maxBookings: users.maxBookings,
        totalHostMinutes: users.totalHostMinutes,
        userCreatedAt: users.createdAt,
        userUpdatedAt: users.updatedAt,
        // Booking fields (nullable due to LEFT JOIN)
        bookingId: bookedRooms.id,
        roomName: bookedRooms.roomName,
        lobbyEnabled: bookedRooms.lobbyEnabled,
        meetingPassword: bookedRooms.meetingPassword,
        maxOccupants: bookedRooms.maxOccupants,
        bookingEndDate: bookedRooms.endDate,
        bookingCreatedAt: bookedRooms.createdAt,
        bookingUpdatedAt: bookedRooms.updatedAt,
      })
      .from(users)
      .leftJoin(bookedRooms, eq(users.id, bookedRooms.userId))
      .where(eq(users.email, email));

    if (userWithBookings.length === 0) {
      logger.error(`User not found: ${email}`);
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Extract user data from first row (all rows have same user data)
    const firstRow = userWithBookings[0];
    const userRecord = {
      id: firstRow.userId,
      email: firstRow.userEmail,
      isActiveHost: firstRow.isActiveHost,
      maxBookings: firstRow.maxBookings,
      totalHostMinutes: firstRow.totalHostMinutes,
      createdAt: firstRow.userCreatedAt,
      updatedAt: firstRow.userUpdatedAt,
    };

    // Extract booked rooms (filter out null booking IDs)
    const userBookedRooms = userWithBookings
      .filter(row => row.bookingId !== null)
      .map(row => ({
        id: row.bookingId,
        roomName: row.roomName,
        lobbyEnabled: row.lobbyEnabled,
        meetingPassword: row.meetingPassword,
        maxOccupants: row.maxOccupants,
        endDate: row.bookingEndDate,
        createdAt: row.bookingCreatedAt,
        updatedAt: row.bookingUpdatedAt,
      }));

    // Return user object with booked rooms
    const response = {
      user: userRecord,
      bookedRooms: userBookedRooms,
    };

    logger.info(`Successfully retrieved user data for: ${email}`);
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (e) {
    logger.error(e, "Error handling db-user request:");
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

/**
 * DELETE endpoint that deletes a user and all associated accounts.
 * Only accessible with CF_WEBHOOK_SECRET for backend operations.
 * Deletes user from database and associated Keycloak, Paddle, and Brevo accounts.
 * 
 * Request body should contain:
 * - email: string (required)
 */
const DeleteWorkerHandler: APIRoute = async ({ request, locals }) => {
  try {
    // Verify secret token
    const authHeader = request.headers.get("Authorization");
    const secretToken = authHeader?.replace("Bearer ", "");

    if (!secretToken || secretToken !== CF_WEBHOOK_SECRET) {
      logger.error("Invalid or missing authentication token for user deletion");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Parse the request body
    interface DeleteUserRequestBody {
      email: string;
    }

    let requestBody: DeleteUserRequestBody;
    try {
      requestBody = (await request.json()) as DeleteUserRequestBody;
    } catch (e) {
      logger.error(e, "Invalid JSON in request body:");
      return new Response(
        JSON.stringify({
          error: "Invalid JSON in request body",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { email } = requestBody;

    if (!email) {
      logger.error("Missing required parameter: email");
      return new Response(
        JSON.stringify({
          error: "Missing required parameter: email",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    logger.info(`Starting user deletion process for: ${email}`);

    // Create database connection
    const db = createDb();

    // Get user data first
    const userRecord = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (userRecord.length === 0) {
      logger.error(`User not found: ${email}`);
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const user = userRecord[0];
    const keycloakClient = new KeycloakClient(locals.runtime);

    // Track deletion results
    const deletionResults = {
      database: false,
      keycloak: false,
      paddle: false,
      brevo: false,
    };

    try {
      // 1. Delete from Keycloak
      try {
        const keycloakUser = await keycloakClient.getUser(email);
        if (keycloakUser) {
          const keycloakDeleted = await keycloakClient.deleteUser(keycloakUser.id);
          deletionResults.keycloak = keycloakDeleted;
          logger.info(`Keycloak user deletion: ${keycloakDeleted ? 'success' : 'failed'}`);
        } else {
          logger.info("Keycloak user not found, skipping deletion");
          deletionResults.keycloak = true; // Consider as success if user doesn't exist
        }
      } catch (e) {
        logger.error(e, "Error deleting Keycloak user:");
        deletionResults.keycloak = false;
      }

      // 2. Archive Paddle customer (soft delete)
      try {
        const paddleCustomer = await PaddleClient.fetchCustomer(email);
        if (paddleCustomer) {
          const paddleDeleted = await PaddleClient.deleteCustomer(paddleCustomer.id);
          deletionResults.paddle = paddleDeleted;
          logger.info(`Paddle customer archival: ${paddleDeleted ? 'success' : 'failed'}`);
        } else {
          logger.info("Paddle customer not found, skipping deletion");
          deletionResults.paddle = true; // Consider as success if customer doesn't exist
        }
      } catch (e) {
        logger.error(e, "Error archiving Paddle customer:");
        deletionResults.paddle = false;
      }

      // 3. Delete from Brevo
      try {
        const brevoDeleted = await BrevoClient.deleteContact(email, 'email_id');
        deletionResults.brevo = brevoDeleted;
        logger.info(`Brevo contact deletion: ${brevoDeleted ? 'success' : 'failed'}`);
      } catch (e) {
        logger.error(e, "Error deleting Brevo contact:");
        deletionResults.brevo = false;
      }

      // 4. Delete from database (delete booked rooms first due to foreign key constraint)
      try {
        // Delete user's booked rooms first
        await db.delete(bookedRooms).where(eq(bookedRooms.userId, user.id));
        
        // Then delete the user
        await db.delete(users).where(eq(users.id, user.id));
        
        deletionResults.database = true;
        logger.info("Database user deletion: success");
      } catch (e) {
        logger.error(e, "Error deleting user from database:");
        deletionResults.database = false;
      }

      // Check if all deletions were successful
      const allSuccessful = Object.values(deletionResults).every(result => result === true);

      if (allSuccessful) {
        logger.info(`Successfully deleted user and all associated accounts for: ${email}`);
        return new Response(
          JSON.stringify({
            message: "User and all associated accounts deleted successfully",
            email: email,
            deletionResults: deletionResults,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      } else {
        logger.warn(deletionResults, `Partial deletion completed for user: ${email}`);
        return new Response(
          JSON.stringify({
            message: "User deletion partially completed",
            email: email,
            deletionResults: deletionResults,
            warning: "Some services failed to delete the user account",
          }),
          {
            status: 207, // Multi-Status
            headers: { "Content-Type": "application/json" },
          }
        );
      }

    } catch (e) {
      logger.error(e, `Error during user deletion process for ${email}:`);
      return new Response(
        JSON.stringify({
          error: "Failed to delete user",
          email: email,
          deletionResults: deletionResults,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

  } catch (e) {
    logger.error(e, "Error handling user deletion request:");
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};