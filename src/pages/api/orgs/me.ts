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

export const GET: APIRoute = async (ctx) => logWrapper(ctx, meHandler);

const meHandler: APIRoute = async ({ request, locals }) => {
  try {
    const authHeader = request.headers.get("Authorization");
    const bearerToken = authHeader?.replace("Bearer ", "");
    if (!bearerToken) {
      return jsonError("Missing Authorization header", 401);
    }

    const email = getEmailFromJWT(bearerToken);
    if (!email) return jsonError("Invalid token - no email", 401);

    const keycloakClient = new KeycloakClient(locals.runtime);
    const isValidToken = await keycloakClient.validateToken(bearerToken);
    if (!isValidToken) return jsonError("Invalid token", 401);

    const kcUser = await keycloakClient.getUser(email);
    if (!kcUser?.id) return jsonError("Keycloak user not found", 404);

    const db = createDb();

    const [dbUser] =
      (await db.select().from(users).where(eq(users.email, email)).limit(1)) ??
      [];
    if (!dbUser?.id) {
      return jsonError("User not found in database", 404);
    }

    // Prefer DB membership for fast reads
    const membership = await db
      .select({
        orgId: organizations.id,
        kcOrgId: organizations.kcOrgId,
        orgName: organizations.name,
        orgAlias: organizations.alias,
        ownerUserId: organizations.ownerUserId,
        role: organizationMembers.role,
      })
      .from(organizationMembers)
      .innerJoin(
        organizations,
        eq(organizationMembers.orgId, organizations.id),
      )
      .where(eq(organizationMembers.userId, dbUser.id))
      .limit(1);

    if (membership.length === 0) {
      return new Response(JSON.stringify({ organization: null }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const org = membership[0];

    // Fetch members list from DB
    const members = await db
      .select({
        id: organizationMembers.id,
        userId: users.id,
        email: users.email,
        role: organizationMembers.role,
        joinedAt: organizationMembers.joinedAt,
      })
      .from(organizationMembers)
      .innerJoin(users, eq(organizationMembers.userId, users.id))
      .where(eq(organizationMembers.orgId, org.orgId));

    return new Response(
      JSON.stringify({
        organization: {
          id: org.orgId,
          kcOrgId: org.kcOrgId,
          name: org.orgName,
          alias: org.orgAlias,
          role: org.role,
          members,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    logger.error(e, "Error fetching org profile:");
    return jsonError("Internal server error", 500);
  }
};

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
