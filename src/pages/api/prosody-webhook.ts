import { getLogger, logWrapper } from "../../lib/modules/pino-logger";
import { capturePosthogEvent } from "../../lib/modules/posthog";
import type { APIRoute } from "astro";
import { CF_WEBHOOK_SECRET } from "astro:env/server";
import { createDb } from "../../lib/db/drizzle";
import { users } from "../../lib/db/schema";
import { eq, sql } from "drizzle-orm";


export const prerender = false;
const logger = getLogger();

/**
 * Receive events from the prosody service
 *
 * This API requires a valid Bearer access token
 * and returns nothing.
 */
export const POST: APIRoute = async (c) => {
    return await logWrapper(c, WorkerHandler)
}

const WorkerHandler: APIRoute = async ({ request, locals }) => {
    try {
        // Verify secret token
        const authHeader = request.headers.get("Authorization");
        const secretToken = authHeader?.replace("Bearer ", "");

        if (!secretToken || secretToken !== CF_WEBHOOK_SECRET) {
            logger.error("Invalid or missing authentication token");
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
            });
        }

        // Parse the request body
        interface ProsodyWebhookBody {
            type: string;
            room: string;
            email: string;
        }

        let requestBody: ProsodyWebhookBody;
        try {
            requestBody = (await request.json()) as ProsodyWebhookBody;
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

        const { type, room, email } = requestBody;

        // Validate required fields
        if (!type || !room || !email) {
            logger.error("Missing required parameters: type, room, and email");
            return new Response(
                JSON.stringify({
                    error: "Missing required parameters: type, room, and email",
                }),
                {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }

        logger.info(`Received prosody webhook event: ${type} for room: ${room}, email: ${email}`);

        // Handle specific event types asynchronously using waitUntil
        if (type === 'HOST_ASSIGNED' || type === 'HOST_LEFT') {
            // Use waitUntil to process the event asynchronously
            // This allows us to return immediately to the caller
            locals.runtime.ctx.waitUntil(handleHostEvent(type, room, email));
        } else {
            logger.info(`Unhandled event type: ${type}, ignoring`);
        }

        // Return immediately - processing happens in background
        return new Response(null, { status: 200 });

    } catch (e) {
        logger.error(e, "Error handling prosody webhook:");
        return new Response(JSON.stringify({ error: "Internal server error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
};

/**
 * Handle host assignment/removal events asynchronously
 * Updates user's isActiveHost status and tracks total host minutes
 * This function runs in the background via waitUntil
 */
async function handleHostEvent(eventType: string, room: string, email: string) {
    try {
        logger.info(`Processing host event ${eventType} for ${email} in room ${room}`);

        const db = createDb();

        // Get the user
        const [userRecord] = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

        if (!userRecord) {
            logger.error(`User not found for host event: ${email}`);
            return;
        }

        if (eventType === 'HOST_ASSIGNED') {
            // User became a host - record the start time
            const now = new Date();
            await db
                .update(users)
                .set({
                    isActiveHost: true,
                    hostSessionStartTime: now,
                    updatedAt: now,
                })
                .where(eq(users.id, userRecord.id));

            logger.info(`Successfully processed HOST_ASSIGNED for user ${email} in room: ${room}`);
        } else if (eventType === 'HOST_LEFT') {
            // User left as host - calculate duration and update total minutes
            const now = new Date();
            let totalMinutesToAdd = 0;

            if (userRecord.hostSessionStartTime) {
                // Calculate duration in minutes
                const durationMs = now.getTime() - userRecord.hostSessionStartTime.getTime();
                const durationMinutes = Math.floor(durationMs / (1000 * 60));
                totalMinutesToAdd = Math.max(0, durationMinutes); // Ensure non-negative
            }
            // Send event to PostHog with meeting time
            // await capturePosthogEvent({
            //     distinctId: `meeting_${room}`,
            //     event: 'meeting_host_left',
            // });

            // Update user: set inactive, clear session start time, add to total minutes
            await db
                .update(users)
                .set({
                    isActiveHost: false,
                    hostSessionStartTime: null,
                    totalHostMinutes: sql`${users.totalHostMinutes} + ${totalMinutesToAdd}`,
                    updatedAt: now,
                })
                .where(eq(users.id, userRecord.id));

            logger.info(`Successfully processed HOST_LEFT for user ${email} in room: ${room}, session duration: ${totalMinutesToAdd} minutes`);
        }

    } catch (e) {
        // Log error but don't throw - this runs asynchronously via waitUntil
        logger.error(e, `Error processing host event ${eventType} for ${email} in room ${room}:`);
    }
}
