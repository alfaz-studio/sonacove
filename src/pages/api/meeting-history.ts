import type { APIRoute } from "astro";
import { getLogger, logWrapper } from "../../lib/modules/pino-logger";
import { KeycloakClient } from "../../lib/modules/keycloak";
import { getEmailFromJWT } from "../../lib/modules/jwt";
import { createDb } from "../../lib/db/drizzle";
import { meetings, meetingEvents, users } from "../../lib/db/schema";
import { and, gte, lte, inArray } from "drizzle-orm";
import type { MeetingMetaData } from "@/data/meeting-types";

export const prerender = false;
const logger = getLogger();

export const GET: APIRoute = async (c) => {
  return await logWrapper(c, WorkerHandler);
};

/**
 * GET endpoint that returns meetings for the authenticated user.
 * Validates the bearer token, then queries meetings and meeting_events tables
 * to build a simplified meeting view.
 */
const WorkerHandler: APIRoute = async ({ request, locals }) => {
  try {
    // Extract Bearer token from Authorization header
    const authHeader = request.headers.get("Authorization");
    const bearerToken = authHeader?.replace("Bearer ", "");

    if (!bearerToken) {
      logger.error("Missing Authorization header");
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Validate token using KeycloakClient
    const keycloakClient = new KeycloakClient(locals.runtime);
    const isValidToken = await keycloakClient.validateToken(bearerToken);

    if (!isValidToken) {
      logger.error("Invalid bearer token");
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Extract email from JWT token
    const userEmail = getEmailFromJWT(bearerToken);

    if (!userEmail) {
      logger.error("Could not extract email from JWT token");
      return new Response(JSON.stringify({ error: "Invalid token - no email found" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Parse query parameters for date range
    const url = new URL(request.url);
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");

    let fromDate: Date | null = null;
    let toDate: Date | null = null;

    if (fromParam) {
      fromDate = new Date(fromParam);
      if (isNaN(fromDate.getTime())) {
        return new Response(JSON.stringify({ error: "Invalid 'from' date parameter" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    if (toParam) {
      toDate = new Date(toParam);
      if (isNaN(toDate.getTime())) {
        return new Response(JSON.stringify({ error: "Invalid 'to' date parameter" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      // Set to end of day
      toDate.setHours(23, 59, 59, 999);
    }

    // Create database connection
    const db = createDb();

    // Build where clause for date range filtering
    const whereConditions = [];
    if (fromDate) {
      whereConditions.push(gte(meetings.startedAt, fromDate));
    }
    if (toDate) {
      whereConditions.push(lte(meetings.startedAt, toDate));
    }

    // Query meetings within date range
    const meetingsList = await db
      .select()
      .from(meetings)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(meetings.startedAt);

    if (meetingsList.length === 0) {
      logger.info(`No meetings found for date range`);
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get all meeting IDs
    const meetingIds = meetingsList.map((m) => m.id);

    // Query all events for these meetings
    const eventsList = await db
      .select()
      .from(meetingEvents)
      .where(inArray(meetingEvents.meetingId, meetingIds))
      .orderBy(meetingEvents.timestamp);

    // Group events by meeting ID
    const eventsByMeeting = new Map<number, typeof eventsList>();
    for (const event of eventsList) {
      if (!eventsByMeeting.has(event.meetingId)) {
        eventsByMeeting.set(event.meetingId, []);
      }
      eventsByMeeting.get(event.meetingId)!.push(event);
    }

    // Aggregate data for each meeting
    const aggregatedMeetings: MeetingMetaData[] = [];

    for (const meeting of meetingsList) {
      const events = eventsByMeeting.get(meeting.id) || [];

      // Track unique participants (by email if available, otherwise by occupant_jid)
      const participantsSet = new Set<string>();
      const participantMap = new Map<string, { email: string | null; name: string | null }>();

      // Track unique hosts
      const hostsSet = new Set<string>();

      // Process events to extract participants and hosts
      for (const event of events) {
        const metadata = event.metadata as any;

        // Extract participants from occupant_joined events
        if (event.eventType === "occupant_joined" && metadata?.occupant) {
          const occupant = metadata.occupant;
          const email = occupant.email || null;
          const name = occupant.name || null;
          const occupantJid = occupant.occupant_jid || null;

          // Use email as identifier if available, otherwise use occupant_jid or name
          const identifier = email || occupantJid || name || null;
          if (identifier) {
            participantsSet.add(identifier);
            if (!participantMap.has(identifier)) {
              participantMap.set(identifier, { email, name });
            }
          }
        }

        // Extract hosts from host_assigned events
        if (event.eventType === "host_assigned" && metadata?.email) {
          hostsSet.add(metadata.email);
        }
      }

      // Calculate duration
      const startedAt = meeting.startedAt.getTime();
      const endedAt = meeting.endedAt ? meeting.endedAt.getTime() : Date.now();
      const durationMinutes = Math.floor((endedAt - startedAt) / (1000 * 60));

      // Determine status
      let status: "completed" | "scheduled" | "in_progress" | "cancelled" = "completed";
      if (meeting.status === "ongoing") {
        status = "in_progress";
      } else if (meeting.status === "ended") {
        status = "completed";
      }

      // Get host emails array
      const hostsArray = Array.from(hostsSet).filter((e): e is string => e !== null && e !== undefined);
      const firstHostEmail = hostsArray[0] || null;

      // Query users table to get host names for emails that exist in the database
      const hostNamesArray: string[] = [];
      if (hostsArray.length > 0) {
        const hostUsers = await db
          .select({
            email: users.email,
          })
          .from(users)
          .where(inArray(users.email, hostsArray));

        const hostEmailsInDb = new Set(hostUsers.map(u => u.email));

        // Build host names array - use email prefix for users not in DB (guests)
        for (const hostEmail of hostsArray) {
          if (hostEmailsInDb.has(hostEmail)) {
            // For registered users, we could query their name, but for now use email prefix
            const namePart = hostEmail.split("@")[0];
            hostNamesArray.push(
              namePart.split(".").map(part => 
                part.charAt(0).toUpperCase() + part.slice(1)
              ).join(" ")
            );
          } else {
            // Guest host - use email prefix
            const namePart = hostEmail.split("@")[0];
            hostNamesArray.push(
              namePart.split(".").map(part => 
                part.charAt(0).toUpperCase() + part.slice(1)
              ).join(" ")
            );
          }
        }
      }

      const hostName = hostNamesArray[0] || (firstHostEmail ? firstHostEmail.split("@")[0] : "Unknown");

      // Build participants array (emails when available, otherwise identifiers)
      const participantsArray = Array.from(participantsSet);

      // Build meeting metadata
      const meetingMetaData: MeetingMetaData = {
        id: String(meeting.id),
        title: meeting.roomName,
        timestamp: startedAt,
        endTimestamp: endedAt,
        email: firstHostEmail || "", // Keep for backward compatibility
        hostName: hostName, // Keep for backward compatibility
        hosts: hostsArray, // Already filtered to remove nulls
        hostNames: hostNamesArray,
        duration: durationMinutes,
        participants: participantsArray,
        participantCount: participantsArray.length,
        status: status,
        recordings: [], // Empty for now
        transcript: null,
        whiteboard: null,
        sharedFiles: [],
        chatLog: [],
        polls: [],
        attendance: [], // Could be built from events if needed
        aiSummary: null,
        roomName: meeting.roomName,
        isRecorded: false,
        hasTranscript: false,
      };

      aggregatedMeetings.push(meetingMetaData);
    }

    logger.info(`Successfully retrieved ${aggregatedMeetings.length} meetings for: ${userEmail}`);
    return new Response(JSON.stringify(aggregatedMeetings), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    logger.error(e, "Error handling meetings request:");
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
