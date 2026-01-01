import type { APIRoute } from "astro";
import { getEmailFromJWT } from "../../../lib/modules/jwt";
import { KeycloakClient } from "../../../lib/modules/keycloak";
import { getLogger, logWrapper } from "../../../lib/modules/pino-logger";
import { createDb } from "../../../lib/db/drizzle";
import {
  users,
  organizations,
  organizationMembers,
  paddleSubscriptions,
} from "../../../lib/db/schema";
import { and, eq } from "drizzle-orm";

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

    // Find org (if any) for this user
    const orgMembership =
      (await db
        .select({
          orgId: organizations.id,
          role: organizationMembers.role,
        })
        .from(organizationMembers)
        .innerJoin(
          organizations,
          eq(organizationMembers.orgId, organizations.id),
        )
        .where(eq(organizationMembers.userId, dbUser.id))
        .limit(1)) ?? [];

    const org = orgMembership[0];

    // Find user's org subscription (by userId and isOrgSubscription flag)
    // This works even if user doesn't have an org yet
    const [userOrgSub] =
      (await db
        .select()
        .from(paddleSubscriptions)
        .where(
          and(
            eq(paddleSubscriptions.userId, dbUser.id),
            eq(paddleSubscriptions.isOrgSubscription, true),
          ),
        )
        .limit(1)) ?? [];

    let orgSubscription = null;
    let seatsUsed: number = 0;
    let seatsTotal: number | null = null;
    let seatsAvailable: number | null = null;

    // If user is in an org, check for subscription linked to that org (preferred)
    if (org) {
      const [orgLinkedSub] =
        (await db
          .select()
          .from(paddleSubscriptions)
          .where(eq(paddleSubscriptions.orgId, org.orgId))
          .limit(1)) ?? [];

      if (orgLinkedSub) {
        orgSubscription = orgLinkedSub;
        const members = await db
          .select({ 
            status: organizationMembers.status,
            role: organizationMembers.role,
          })
          .from(organizationMembers)
          .where(eq(organizationMembers.orgId, org.orgId));

        // Only count admin and teacher roles toward seats (exclude owner and student)
        seatsUsed = members.filter(
          (m) => (m.status === "active" || m.status === "pending") &&
                 (m.role === "admin" || m.role === "teacher"),
        ).length;
        seatsTotal = orgLinkedSub.quantity ?? 1;
        seatsAvailable = Math.max(0, seatsTotal - seatsUsed);
      }
    }

    // If no org-linked subscription found, use user-linked org subscription
    if (!orgSubscription && userOrgSub) {
      orgSubscription = userOrgSub;
      seatsTotal = userOrgSub.quantity ?? 1;
      // If user doesn't have an org yet, seatsUsed is 0
      seatsUsed = org ? seatsUsed : 0;
      seatsAvailable = Math.max(0, seatsTotal - seatsUsed);
    }

    // Individual subscription (not linked to org)
    const [individualSub] =
      (await db
        .select()
        .from(paddleSubscriptions)
        .where(
          and(
            eq(paddleSubscriptions.userId, dbUser.id),
            eq(paddleSubscriptions.isOrgSubscription, false),
          ),
        )
        .limit(1)) ?? [];

    return new Response(
      JSON.stringify({
        individualSubscription: individualSub
          ? {
              status: individualSub.status,
              quantity: individualSub.quantity,
              billingInterval: individualSub.billingInterval,
              billingFrequency: individualSub.billingFrequency,
              nextBilledAt: individualSub.nextBilledAt,
              subscriptionId: individualSub.paddleSubscriptionId,
            }
          : null,
        orgSubscription: orgSubscription
          ? {
              status: orgSubscription.status,
              quantity: orgSubscription.quantity,
              billingInterval: orgSubscription.billingInterval,
              billingFrequency: orgSubscription.billingFrequency,
              seatsUsed,
              seatsTotal,
              seatsAvailable,
              subscriptionId: orgSubscription.paddleSubscriptionId,
            }
          : null,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    logger.error(e, "Error fetching subscription summary:");
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};


