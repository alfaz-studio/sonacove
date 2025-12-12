import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { createDb } from "../../../lib/db/drizzle";
import {
  organizationMembers,
  organizations,
  users,
} from "../../../lib/db/schema";
import { validateAuth } from "../../../lib/modules/auth-helper";
import { getLogger, logWrapper } from "../../../lib/modules/pino-logger";

export const prerender = false;
const logger = getLogger();

export const POST: APIRoute = async (ctx) => {
  return logWrapper(ctx, createOrgHandler);
};

const createOrgHandler: APIRoute = async ({ request, locals }) => {
  try {
    const auth = await validateAuth(request, locals.runtime);
    if (auth.error) {
      return auth.error;
    }
    const { email, keycloakClient, kcUser } = auth.result;

    const body = (await request.json().catch(() => null)) as
      | {
          name?: string;
          description?: string;
          alias?: string;
        }
      | null;
    const name = body?.name;
    const description = body?.description;

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
    // Note: domains are not user-provided yet, so createOrganization() will use default "sonacove.com"
    const orgResult = await keycloakClient.createOrganization({
      name,
      alias: body?.alias,
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
        domains: null, // Domains feature not yet implemented
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
