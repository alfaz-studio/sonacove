import type { APIRoute } from "astro";
import { getEmailFromJWT } from "../../../lib/modules/jwt";
import { KeycloakClient } from "../../../lib/modules/keycloak";
import { PaddleClient } from "../../../lib/modules/paddle";
import { getLogger, logWrapper } from "../../../lib/modules/pino-logger";
import { createDb } from "../../../lib/db/drizzle";
import { users, paddleCustomers } from "../../../lib/db/schema";
import { eq } from "drizzle-orm";

export const prerender = false;
const logger = getLogger();

export const GET: APIRoute = async (c) => {
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

    const [pc] =
      (await db
        .select()
        .from(paddleCustomers)
        .where(eq(paddleCustomers.userId, dbUser.id))
        .limit(1)) ?? [];

    const paddleCustomerId = pc?.paddleCustomerId;
    if (!paddleCustomerId) {
      return new Response(
        JSON.stringify({
          error: "No Paddle customer associated with this user",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const portalUrl =
      await PaddleClient.createCustomerPortalSession(paddleCustomerId);

    if (!portalUrl) {
      logger.error("Failed to create customer portal session");
      return new Response(
        JSON.stringify({ error: "Failed to create customer portal session" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify({ url: portalUrl }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    logger.error(e, "Error creating customer portal session:");
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};


