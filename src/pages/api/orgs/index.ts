import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { createDb } from "../../../lib/db/drizzle";
import {
  organizationMembers,
  organizations,
  users,
} from "../../../lib/db/schema";
import { getEmailFromJWT } from "../../../lib/modules/jwt";
import { KeycloakClient } from "../../../lib/modules/keycloak";
import { getLogger, logWrapper } from "../../../lib/modules/pino-logger";

export const prerender = false;
const logger = getLogger();

export const POST: APIRoute = async (ctx) => {
  return logWrapper(ctx, createOrgHandler);
};

const createOrgHandler: APIRoute = async ({ request, locals }) => {
  try {
    const authHeader = request.headers.get("Authorization");
    const bearerToken = authHeader?.replace("Bearer ", "");
    if (!bearerToken) {
      return jsonError("Missing Authorization header", 401);
    }

    const email = getEmailFromJWT(bearerToken);
    if (!email) {
      return jsonError("Invalid token - no email found", 401);
    }

    const keycloakClient = new KeycloakClient(locals.runtime);
    const isValidToken = await keycloakClient.validateToken(bearerToken);
    if (!isValidToken) {
      return jsonError("Invalid token", 401);
    }

    const kcUser = await keycloakClient.getUser(email);
    if (!kcUser?.id) {
      return jsonError("Keycloak user not found", 404);
    }

    const body = await request.json().catch(() => null);
    const name = body?.name as string | undefined;
    const domains = (body?.domains as string[] | undefined)?.filter(Boolean);
    const description = body?.description as string | undefined;

    if (!name) {
      return jsonError("Missing required field: name", 400);
    }

    const db = createDb();

    // Ensure app user exists
    const [dbUser] =
      (await db.select().from(users).where(eq(users.email, email)).limit(1)) ??
      [];
    const userId =
      dbUser?.id ??
      (
        await db
          .insert(users)
          .values({
            email,
            isActiveHost: false,
            maxBookings: 1,
            totalHostMinutes: 0,
          })
          .returning({ id: users.id })
      )[0].id;

    // Check if caller already belongs to an org
    const existingMembership = await db
      .select({
        orgId: organizations.id,
        role: organizationMembers.role,
      })
      .from(organizationMembers)
      .innerJoin(
        organizations,
        eq(organizationMembers.orgId, organizations.id),
      )
      .where(eq(organizationMembers.userId, userId))
      .limit(1);

    if (existingMembership.length > 0) {
      return jsonError("User already belongs to an organization", 409);
    }

    // Create org in Keycloak
    const orgResult = await keycloakClient.createOrganization({
      name,
      alias: body?.alias,
      domains,
      description,
    });

    if (!orgResult?.id) {
      return jsonError("Failed to create organization in Keycloak", 500);
    }

    // Persist org + membership in DB
    const [orgRow] = await db
      .insert(organizations)
      .values({
        kcOrgId: orgResult.id,
        name,
        alias: orgResult.alias ?? name,
        ownerUserId: userId,
        domains: domains ?? null,
      })
      .returning({
        id: organizations.id,
        kcOrgId: organizations.kcOrgId,
        name: organizations.name,
        alias: organizations.alias,
      });

    await db.insert(organizationMembers).values({
      orgId: orgRow.id,
      userId,
      role: "owner",
      status: "active",
      kcUserId: kcUser.id,
    });

    // Add member in Keycloak (owner)
    await keycloakClient.addMemberToOrganization(orgResult.id, kcUser.id);

    return new Response(
      JSON.stringify({
        organization: {
          id: orgRow.id,
          kcOrgId: orgRow.kcOrgId,
          name: orgRow.name,
          alias: orgRow.alias,
          role: "owner",
        },
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    logger.error(e, "Error creating organization:");
    return jsonError("Internal server error", 500);
  }
};

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
