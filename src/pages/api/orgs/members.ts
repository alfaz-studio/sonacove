import type { APIRoute } from "astro";
import { and, eq } from "drizzle-orm";
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

export const POST: APIRoute = async (ctx) => logWrapper(ctx, addMember);
export const DELETE: APIRoute = async (ctx) => logWrapper(ctx, removeMember);

async function addMember({ request, locals }: Parameters<APIRoute>[0]) {
  try {
    const auth = await validateAuth(request, locals.runtime);
    if (auth.error) {
      return auth.error;
    }
    const { email, keycloakClient } = auth.result;

    const body = (await request.json().catch(() => null)) as
      | { email?: string }
      | null;
    const targetEmail = body?.email;
    if (!targetEmail) return jsonError("Missing required field: email", 400);

    const db = createDb();

    // Ensure caller exists in DB and is owner
    const [callerDb] =
      (await db.select().from(users).where(eq(users.email, email)).limit(1)) ??
      [];
    if (!callerDb?.id) return jsonError("User not found in database", 404);

    const callerMembership = await db
      .select({
        orgId: organizations.id,
        kcOrgId: organizations.kcOrgId,
        role: organizationMembers.role,
      })
      .from(organizationMembers)
      .innerJoin(
        organizations,
        eq(organizationMembers.orgId, organizations.id),
      )
      .where(eq(organizationMembers.userId, callerDb.id))
      .limit(1);

    if (callerMembership.length === 0) {
      return jsonError("User is not part of an organization", 403);
    }

    const membership = callerMembership[0];
    if (membership.role !== "owner") {
      return jsonError("Only owners can manage members", 403);
    }

    // Resolve target user
    const kcTarget = await keycloakClient.getUser(targetEmail);
    if (!kcTarget?.id) {
      return jsonError("User not found in Keycloak", 404);
    }

    const [targetDb] =
      (await db.select().from(users).where(eq(users.email, targetEmail)).limit(1)) ??
      [];
    const targetDbId =
      targetDb?.id ??
      (
        await db
          .insert(users)
          .values({
            email: targetEmail,
            isActiveHost: false,
            maxBookings: 1,
            totalHostMinutes: 0,
          })
          .returning({ id: users.id })
      )[0].id;

    // Check existing membership
    const existing = await db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, targetDbId))
      .limit(1);
    if (existing.length > 0) {
      return jsonError("User already belongs to an organization", 409);
    }

    // Enforce seat limits if an org subscription exists
    const [orgSubscription] =
      (await db
        .select()
        .from(paddleSubscriptions)
        .where(eq(paddleSubscriptions.orgId, membership.orgId))
        .limit(1)) ?? [];

    if (orgSubscription) {
      const currentMembers = await db
        .select({
          status: organizationMembers.status,
        })
        .from(organizationMembers)
        .where(eq(organizationMembers.orgId, membership.orgId));

      const seatsUsed = currentMembers.filter(
        (m) => m.status === "active" || m.status === "pending",
      ).length;
      const seatsTotal = orgSubscription.quantity ?? 1;

      if (seatsUsed >= seatsTotal) {
        return jsonError(
          "Your organization has reached its seat limit. Please upgrade your plan to add more members.",
          403,
        );
      }
    }

    // Add to Keycloak org
    const kcAdded = await keycloakClient.addMemberToOrganization(
      membership.kcOrgId,
      kcTarget.id,
    );
    if (!kcAdded) {
      return jsonError("Failed to add member in Keycloak", 500);
    }

    await db.insert(organizationMembers).values({
      orgId: membership.orgId,
      userId: targetDbId,
      role: "teacher",
    });

    return new Response(
      JSON.stringify({ success: true, email: targetEmail }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    logger.error(e, "Error adding member:");
    return jsonError("Internal server error", 500);
  }
}

async function removeMember({ request, locals }: Parameters<APIRoute>[0]) {
  try {
    const auth = await validateAuth(request, locals.runtime);
    if (auth.error) {
      return auth.error;
    }
    const { email, keycloakClient } = auth.result;

    const body = (await request.json().catch(() => null)) as
      | { email?: string }
      | null;
    const targetEmail = body?.email;
    if (!targetEmail) return jsonError("Missing required field: email", 400);

    const db = createDb();
    const [callerDb] =
      (await db.select().from(users).where(eq(users.email, email)).limit(1)) ??
      [];
    if (!callerDb?.id) return jsonError("User not found in database", 404);

    const callerMembership = await db
      .select({
        orgId: organizations.id,
        kcOrgId: organizations.kcOrgId,
        role: organizationMembers.role,
      })
      .from(organizationMembers)
      .innerJoin(
        organizations,
        eq(organizationMembers.orgId, organizations.id),
      )
      .where(eq(organizationMembers.userId, callerDb.id))
      .limit(1);

    if (callerMembership.length === 0) {
      return jsonError("User is not part of an organization", 403);
    }

    const membership = callerMembership[0];
    if (membership.role !== "owner") {
      return jsonError("Only owners can manage members", 403);
    }

    // Resolve target membership
    const [targetDb] =
      (await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, targetEmail))
        .limit(1)) ?? [];
    if (!targetDb?.id) {
      return jsonError("User not found in database", 404);
    }

    const targetMembership = await db
      .select({
        memberId: organizationMembers.id,
        userId: organizationMembers.userId,
        kcUserId: organizationMembers.kcUserId,
        status: organizationMembers.status,
      })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.orgId, membership.orgId),
          eq(organizationMembers.userId, targetDb.id),
        ),
      )
      .limit(1);

    if (targetMembership.length === 0) {
      return jsonError("User is not part of this organization", 404);
    }

    const member = targetMembership[0];

    // Prevent removing self as sole owner
    if (targetDb.id === callerDb.id) {
      return jsonError("Owners cannot remove themselves", 400);
    }

    // Remove from Keycloak if they have a KC user ID and are active
    if (member.kcUserId && member.status === "active") {
      const kcTarget = await keycloakClient.getUser(targetEmail);
      if (kcTarget?.id) {
        await keycloakClient.removeMemberFromOrganization(
          membership.kcOrgId,
          kcTarget.id,
        );
      }
    }

    // Remove from DB (works for both pending and active)
    await db
      .delete(organizationMembers)
      .where(eq(organizationMembers.id, member.memberId));

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    logger.error(e, "Error removing member:");
    return jsonError("Internal server error", 500);
  }
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
