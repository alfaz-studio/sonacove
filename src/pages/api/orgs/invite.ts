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

export const POST: APIRoute = async (ctx) => logWrapper(ctx, inviteHandler);

const inviteHandler: APIRoute = async ({ request, locals }) => {
  try {
    const auth = await validateAuth(request, locals.runtime);
    if (auth.error) {
      return auth.error;
    }
    const { email, keycloakClient } = auth.result;

    const body = (await request.json().catch(() => null)) as
      | {
          email?: string;
          firstName?: string;
          lastName?: string;
        }
      | null;
    const inviteEmail = body?.email;
    const firstName = body?.firstName;
    const lastName = body?.lastName;

    if (!inviteEmail || !inviteEmail.includes("@")) {
      return jsonError("Missing or invalid email address", 400);
    }

    const db = createDb();

    // Ensure caller exists in DB and is owner
    const [callerDb] =
      (await db.select().from(users).where(eq(users.email, email)).limit(1)) ??
      [];
    if (!callerDb?.id) {
      return jsonError("User not found in database", 404);
    }

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
      return jsonError("Only owners can invite members", 403);
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
          "Your organization has reached its seat limit. Please upgrade your plan to invite more members.",
          403,
        );
      }
    }

    // Check if target user already belongs to any org (DB check)
    const kcTarget = await keycloakClient.getUser(inviteEmail);
    let targetDbId: number | null = null;

    if (kcTarget?.id) {
      // Existing user - check DB membership
      const [targetDb] =
        (await db
          .select()
          .from(users)
          .where(eq(users.email, inviteEmail))
          .limit(1)) ?? [];
      if (targetDb?.id) {
        const existingMembership = await db
          .select()
          .from(organizationMembers)
          .where(eq(organizationMembers.userId, targetDb.id))
          .limit(1);
        if (existingMembership.length > 0) {
          return jsonError("User already belongs to an organization", 409);
        }
        targetDbId = targetDb.id;
      }

      // Optional: check KC orgs as well
      const kcOrgs = await keycloakClient.getUserOrganizations(kcTarget.id);
      if (kcOrgs.length > 0) {
        return jsonError("User already belongs to an organization", 409);
      }
    }

    // If target doesn't exist in DB yet, we'll create a placeholder user row
    // but mark membership as pending
    if (!targetDbId) {
      const [newUser] = await db
        .insert(users)
        .values({
          email: inviteEmail,
          isActiveHost: false,
          maxBookings: 1,
          totalHostMinutes: 0,
        })
        .returning({ id: users.id });
      targetDbId = newUser.id;
    }

    // Invite via Keycloak
    const inviteSuccess = await keycloakClient.inviteUserToOrganization(
      membership.kcOrgId,
      {
        email: inviteEmail,
        firstName,
        lastName,
      },
    );

    if (!inviteSuccess) {
      return jsonError("Failed to send invitation via Keycloak", 500);
    }

    // Create pending membership row
    await db.insert(organizationMembers).values({
      orgId: membership.orgId,
      userId: targetDbId,
      role: "teacher",
      status: "pending",
      invitedEmail: inviteEmail,
      invitedAt: new Date(),
      kcUserId: kcTarget?.id ?? null,
    });

    return new Response(
      JSON.stringify({
        success: true,
        email: inviteEmail,
        status: "pending",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    logger.error(e, "Error inviting user:");
    return jsonError("Internal server error", 500);
  }
};

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
