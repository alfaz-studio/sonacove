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
import { PaddleClient } from "../../../lib/modules/paddle";

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
          domain?: string;
        }
      | null;
    const name = body?.name;
    const description = body?.description;
    const domain = body?.domain;

    if (!name) {
      return jsonError("Missing required field: name", 400);
    }

    if (!domain) {
      return jsonError("Missing required field: domain", 400);
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

    // Ensure Paddle customer mapping exists for owner
    let ownerPaddleCustomerId: string | null = null;
    try {
      const [existingPaddleCustomer] =
        (await db
          .select()
          .from(paddleCustomers)
          .where(eq(paddleCustomers.userId, userId))
          .limit(1)) ?? [];

      if (existingPaddleCustomer) {
        ownerPaddleCustomerId = existingPaddleCustomer.paddleCustomerId;
      } else {
        const fullName =
          kcUser.firstName && kcUser.lastName
            ? `${kcUser.firstName} ${kcUser.lastName}`
            : kcUser.firstName || kcUser.lastName || email.split("@")[0];

        const paddleCustomer = await PaddleClient.setCustomer({
          email,
          ...(fullName ? { name: fullName } : {}),
        });

        if (paddleCustomer?.id) {
          ownerPaddleCustomerId = paddleCustomer.id;
          // Note: We no longer write to paddle_customers directly here.
          // Paddle will send a webhook event (customer.updated or customer.created)
          // which will update the paddle_customers table via the Paddle webhook handler.
        }
      }
    } catch (e) {
      logger.error(e, "Failed to ensure Paddle customer for org owner:");
    }

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
      description,
      domains: [domain],
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

    // Create a Paddle business for this org if we have a Paddle customer
    if (ownerPaddleCustomerId) {
      try {
        const business = await PaddleClient.createBusinessForCustomer(
          ownerPaddleCustomerId,
          {
            name,
            // Basic payload - can be extended to include tax/address data later
            address: {
              country_code: "US",
            },
          },
        );

        if (business?.id) {
          // Note: We no longer write to paddle_businesses directly here.
          // Paddle will send a webhook event (business.updated or business.created)
          // which will update the paddle_businesses table via the Paddle webhook handler.
        }
      } catch (e) {
        logger.error(e, "Failed to create Paddle business for organization:");
      }
    }

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
