import { getLogger, logWrapper } from "../../lib/modules/pino-logger";
import type { APIRoute } from "astro";
import { CF_WEBHOOK_SECRET } from "astro:env/server";
import { createDb } from "../../lib/db/drizzle";
import { users, meetings, meetingEvents } from "../../lib/db/schema";
import { eq, sql, and } from "drizzle-orm";


export const prerender = false;
const logger = getLogger();

export const POST: APIRoute = async (c) => {
    return await logWrapper(c, WorkerHandler);
};

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
        let requestBody: any;
        try {
            requestBody = await request.json();
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

        const eventName: string | undefined = requestBody.event_name ?? requestBody.type;
        const roomName: string | undefined = requestBody.room_name ?? requestBody.room;
        const roomJid: string | undefined = requestBody.room_jid;
        const email: string | undefined = requestBody.email;

        if (!eventName) {
            logger.error("Missing event_name/type");
            return new Response(JSON.stringify({ error: "Missing event_name/type" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        // Basic payload validation for required fields
        const eventsRequiringRoom = new Set([
            "room_created",
            "room_destroyed",
            "occupant_joined",
            "occupant_left",
            "role_changed",
            "affiliation_changed",
            "muc-room-created",
            "muc-room-destroyed",
            "muc-occupant-joined",
            "muc-occupant-left",
            "muc-role-changed",
            "muc-affiliation-changed",
            "HOST_ASSIGNED",
            "HOST_LEFT",
        ]);

        if (eventsRequiringRoom.has(eventName) && !roomName && !roomJid) {
            logger.error(`Missing room identifier for event ${eventName}`);
            return new Response(JSON.stringify({ error: "Missing room or room_jid" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        const eventsRequiringEmail = new Set(["HOST_ASSIGNED", "HOST_LEFT"]);
        if (eventsRequiringEmail.has(eventName) && !email) {
            logger.error(`Missing email for host event ${eventName}`);
            return new Response(JSON.stringify({ error: "Missing email for host event" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        logger.info(`Received prosody webhook event: ${eventName} for room: ${roomName ?? "unknown"}`);

        // Dispatch event processing asynchronously
        locals.runtime.ctx.waitUntil(
            handleWebhookEvent({
                eventName,
                roomName,
                roomJid,
                email,
                payload: requestBody,
            })
        );

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

type WebhookEvent = {
    eventName: string;
    roomName?: string;
    roomJid?: string;
    email?: string;
    payload: any;
};

/**
 * Route webhook events to appropriate handlers
 */
async function handleWebhookEvent(event: WebhookEvent) {
    const { eventName, roomName, roomJid, email, payload } = event;
    const db = createDb();

    switch (eventName) {
        case "muc-room-created":
            await handleRoomCreated(db, payload);
            break;
        case "muc-room-destroyed":
            await handleRoomDestroyed(db, payload);
            break;
        case "muc-occupant-joined":
            await handleOccupantJoined(db, payload);
            break;
        case "muc-occupant-left":
            await handleOccupantLeft(db, payload);
            break;
        case "muc-role-changed":
            await handleRoleChanged(db, payload);
            break;
        case "muc-affiliation-changed":
            await handleAffiliationChanged(db, payload);
            break;
        case "HOST_ASSIGNED":
        case "HOST_LEFT":
            if (!roomName || !email) {
                logger.error("Host event missing room or email");
                return;
            }
            await handleHostEvent(eventName, roomName, email);
            await recordHostMeetingEvent(db, {
                eventType: eventName === "HOST_ASSIGNED" ? "host_assigned" : "host_left",
                roomName,
                roomJid,
                email,
            });
            break;
        default:
            logger.info(`Unhandled event type: ${eventName}, ignoring`);
    }
}

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

/**
 * Meeting/event persistence helpers
 */
async function getOrCreateMeeting(db: ReturnType<typeof createDb>, args: {
    roomName?: string;
    roomJid?: string;
    isBreakout?: boolean;
    breakoutRoomId?: string;
    isLobby?: boolean;
    lobbyRoomId?: string;
    startedAt?: Date;
}) {
    const { roomName, roomJid, isBreakout, breakoutRoomId, isLobby, lobbyRoomId, startedAt } = args;
    if (!roomName && !roomJid) {
        throw new Error("roomName or roomJid required to create meeting");
    }

    const whereClauses = [
        roomJid
            ? eq(meetings.roomJid, roomJid)
            : and(eq(meetings.roomName, roomName ?? ""), eq(meetings.isBreakout, !!isBreakout)),
        eq(meetings.status, "ongoing"),
    ];

    const [existing] = await db
        .select()
        .from(meetings)
        .where(and(...whereClauses))
        .limit(1);

    if (existing) {
        return existing;
    }

    const [inserted] = await db
        .insert(meetings)
        .values({
            roomName: roomName ?? (roomJid ? roomJid.split("@")[1] ?? roomJid : "unknown"),
            roomJid: roomJid ?? roomName ?? "unknown",
            isBreakout: !!isBreakout,
            breakoutRoomId: breakoutRoomId ?? null,
            isLobby: !!isLobby,
            lobbyRoomId: lobbyRoomId ?? null,
            status: "ongoing",
            startedAt: startedAt ?? new Date(),
            updatedAt: new Date(),
        })
        .returning();

    return inserted;
}

function normalizeOccupant(occupant: any) {
    const data = occupant ?? {};
    return {
        occupant_jid: data.occupant_jid ?? data.jid ?? null,
        name: data.name ?? null,
        email: data.email ?? null,
        id: data.id ?? null,
        role: data.role ?? null,
        affiliation: data.affiliation ?? null,
        joined_at: data.joined_at ?? null,
        left_at: data.left_at ?? null,
    };
}

function buildEventMetadata(eventType: string, payload: any) {
    switch (eventType) {
        case "room_created":
            return {
                is_breakout: !!payload.is_breakout,
                breakout_room_id: payload.breakout_room_id ?? null,
                is_lobby: !!payload.is_lobby,
                lobby_room_id: payload.lobby_room_id ?? null,
            };
        case "room_destroyed":
            return {
                destroyed_at: payload.destroyed_at ?? null,
                all_occupants: Array.isArray(payload.all_occupants)
                    ? payload.all_occupants.map(normalizeOccupant)
                    : [],
            };
        case "occupant_joined":
        case "occupant_left":
            return {
                occupant: normalizeOccupant(payload.occupant),
                active_occupants_count: payload.active_occupants_count ?? null,
            };
        case "role_changed":
        case "affiliation_changed":
            return {
                occupant: normalizeOccupant(payload.occupant),
            };
        case "host_assigned":
        case "host_left":
            return {
                email: payload.email ?? null,
                occupant_jid: payload.occupant_jid ?? null,
                role: payload.role ?? null,
                affiliation: payload.affiliation ?? null,
            };
        default:
            return {};
    }
}

async function insertMeetingEvent(db: ReturnType<typeof createDb>, args: {
    meetingId: number;
    eventType: string;
    metadata: any;
    eventTimestamp?: Date;
}) {
    const { meetingId, eventType, metadata, eventTimestamp } = args;
    await db.insert(meetingEvents).values({
        meetingId,
        eventType,
        timestamp: eventTimestamp ?? new Date(),
        metadata,
    });
}

async function handleRoomCreated(db: ReturnType<typeof createDb>, payload: any) {
    const createdAt = payload.created_at ? new Date(payload.created_at * 1000) : undefined;
    const meeting = await getOrCreateMeeting(db, {
        roomName: payload.room_name,
        roomJid: payload.room_jid,
        isBreakout: payload.is_breakout,
        breakoutRoomId: payload.breakout_room_id,
        isLobby: payload.is_lobby,
        lobbyRoomId: payload.lobby_room_id,
        startedAt: createdAt,
    });

    await insertMeetingEvent(db, {
        meetingId: meeting.id,
        eventType: "room_created",
        metadata: buildEventMetadata("room_created", payload),
        eventTimestamp: createdAt,
    });
}

async function handleRoomDestroyed(db: ReturnType<typeof createDb>, payload: any) {
    const meeting = await getOrCreateMeeting(db, {
        roomName: payload.room_name,
        roomJid: payload.room_jid,
        isBreakout: payload.is_breakout,
        breakoutRoomId: payload.breakout_room_id,
        isLobby: payload.is_lobby,
        lobbyRoomId: payload.lobby_room_id,
    });

    const destroyedAt = payload.destroyed_at ? new Date(payload.destroyed_at * 1000) : new Date();

    await db
        .update(meetings)
        .set({
            status: "ended",
            endedAt: destroyedAt,
            updatedAt: new Date(),
        })
        .where(eq(meetings.id, meeting.id));

    await insertMeetingEvent(db, {
        meetingId: meeting.id,
        eventType: "room_destroyed",
        metadata: buildEventMetadata("room_destroyed", payload),
        eventTimestamp: destroyedAt,
    });
}

async function handleOccupantJoined(db: ReturnType<typeof createDb>, payload: any) {
    const meeting = await getOrCreateMeeting(db, {
        roomName: payload.room_name,
        roomJid: payload.room_jid,
        isBreakout: payload.is_breakout,
        breakoutRoomId: payload.breakout_room_id,
        isLobby: payload.is_lobby,
        lobbyRoomId: payload.lobby_room_id,
    });

    await insertMeetingEvent(db, {
        meetingId: meeting.id,
        eventType: "occupant_joined",
        metadata: buildEventMetadata("occupant_joined", payload),
        eventTimestamp: payload.occupant?.joined_at ? new Date(payload.occupant.joined_at * 1000) : undefined,
    });
}

async function handleOccupantLeft(db: ReturnType<typeof createDb>, payload: any) {
    const meeting = await getOrCreateMeeting(db, {
        roomName: payload.room_name,
        roomJid: payload.room_jid,
        isBreakout: payload.is_breakout,
        breakoutRoomId: payload.breakout_room_id,
        isLobby: payload.is_lobby,
        lobbyRoomId: payload.lobby_room_id,
    });

    await insertMeetingEvent(db, {
        meetingId: meeting.id,
        eventType: "occupant_left",
        metadata: buildEventMetadata("occupant_left", payload),
        eventTimestamp: payload.occupant?.left_at ? new Date(payload.occupant.left_at * 1000) : undefined,
    });
}

async function handleRoleChanged(db: ReturnType<typeof createDb>, payload: any) {
    const meeting = await getOrCreateMeeting(db, {
        roomName: payload.room_name,
        roomJid: payload.room_jid,
        isBreakout: payload.is_breakout,
        breakoutRoomId: payload.breakout_room_id,
        isLobby: payload.is_lobby,
        lobbyRoomId: payload.lobby_room_id,
    });

    await insertMeetingEvent(db, {
        meetingId: meeting.id,
        eventType: "role_changed",
        metadata: buildEventMetadata("role_changed", payload),
    });
}

async function handleAffiliationChanged(db: ReturnType<typeof createDb>, payload: any) {
    const meeting = await getOrCreateMeeting(db, {
        roomName: payload.room_name,
        roomJid: payload.room_jid,
        isBreakout: payload.is_breakout,
        breakoutRoomId: payload.breakout_room_id,
        isLobby: payload.is_lobby,
        lobbyRoomId: payload.lobby_room_id,
    });

    await insertMeetingEvent(db, {
        meetingId: meeting.id,
        eventType: "affiliation_changed",
        metadata: buildEventMetadata("affiliation_changed", payload),
    });
}

async function recordHostMeetingEvent(
    db: ReturnType<typeof createDb>,
    args: { eventType: "host_assigned" | "host_left"; roomName: string; roomJid?: string; email: string }
) {
    const meeting = await getOrCreateMeeting(db, {
        roomName: args.roomName,
        roomJid: args.roomJid,
    });

    await insertMeetingEvent(db, {
        meetingId: meeting.id,
        eventType: args.eventType,
        metadata: buildEventMetadata(args.eventType, {
            email: args.email,
        }),
    });
}
