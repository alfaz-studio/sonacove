import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { createDb } from "../../../lib/db/drizzle";
import {
  organizationMembers,
  organizations,
  users,
  paddleSubscriptions,
} from "../../../lib/db/schema";
import { validateAuth } from "../../../lib/modules/auth-helper";
import { getLogger, logWrapper } from "../../../lib/modules/pino-logger";

export const prerender = false;
const logger = getLogger();

export const GET: APIRoute = async (ctx) => logWrapper(ctx, meHandler);

const meHandler: APIRoute = async ({ request, locals }) => {
  try {
    const auth = await validateAuth(request, locals.runtime);
    if (auth.error) {
      return auth.error;
    }
    const { email, keycloakClient } = auth.result;

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
    const dbMembers = await db
      .select({
        id: organizationMembers.id,
        userId: users.id,
        email: users.email,
        role: organizationMembers.role,
        status: organizationMembers.status,
        kcUserId: organizationMembers.kcUserId,
        invitedEmail: organizationMembers.invitedEmail,
        invitedAt: organizationMembers.invitedAt,
        joinedAt: organizationMembers.joinedAt,
      })
      .from(organizationMembers)
      .innerJoin(users, eq(organizationMembers.userId, users.id))
      .where(eq(organizationMembers.orgId, org.orgId));

    // Compute seat usage based on active + pending members
    const seatsUsed = dbMembers.filter(
      (m) => m.status === "active" || m.status === "pending",
    ).length;

    // Find org subscription (if any)
    const [orgSubscription] =
      (await db
        .select()
        .from(paddleSubscriptions)
        .where(eq(paddleSubscriptions.orgId, org.orgId))
        .limit(1)) ?? [];

    const seatsTotal = orgSubscription?.quantity ?? null;
    const seatsAvailable =
      seatsTotal !== null ? Math.max(0, seatsTotal - seatsUsed) : null;

    // Reconcile with Keycloak: check if pending members are now active in KC
    const kcMembers = await keycloakClient.getOrganizationMembers(org.kcOrgId);
    const kcMemberIds = new Set(kcMembers.map((m) => m.id));
    const kcMemberEmails = new Set(kcMembers.map((m) => m.email?.toLowerCase()).filter(Boolean));

    // Update pending members to active if they're in KC (by ID or email)
    for (const member of dbMembers) {
      if (member.status === "pending") {
        const isInKc =
          (member.kcUserId && kcMemberIds.has(member.kcUserId)) ||
          (member.email && kcMemberEmails.has(member.email.toLowerCase()));
        
        if (isInKc) {
          // Update kcUserId if we have it from KC
          const kcMember = kcMembers.find(
            (m) => m.id === member.kcUserId || m.email?.toLowerCase() === member.email?.toLowerCase()
          );
          
          await db
            .update(organizationMembers)
            .set({
              status: "active",
              kcUserId: kcMember?.id ?? member.kcUserId,
            })
            .where(eq(organizationMembers.id, member.id));
          member.status = "active";
          if (kcMember?.id) {
            member.kcUserId = kcMember.id;
          }
        }
      }
    }

    // Format members for response
    const members = dbMembers.map((m) => ({
      id: m.id,
      userId: m.userId,
      email: m.email,
      role: m.role,
      status: m.status,
      invitedEmail: m.invitedEmail,
      invitedAt: m.invitedAt?.toISOString(),
      joinedAt: m.joinedAt?.toISOString(),
    }));

    return new Response(
      JSON.stringify({
        organization: {
          id: org.orgId,
          kcOrgId: org.kcOrgId,
          name: org.orgName,
          alias: org.orgAlias,
          role: org.role,
          members,
          subscription: orgSubscription
            ? {
                status: orgSubscription.status,
                quantity: orgSubscription.quantity,
                seatsUsed,
                seatsTotal,
                seatsAvailable,
              }
            : null,
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
