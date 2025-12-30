import type { APIRoute } from "astro";
import { validateAuth } from "../../lib/modules/auth-helper";
import { getLogger, logWrapper } from "../../lib/modules/pino-logger";
import { createDb } from "../../lib/db/drizzle";
import { meetings, meetingEvents } from "../../lib/db/schema";
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
    const auth = await validateAuth(request, locals.runtime);
    if (auth.error) {
      return auth.error;
    }
    const { email: userEmail } = auth.result;

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

      // Track unique participants (by email if available, otherwise by guest name)
      const participantsSet = new Set<string>();
      const participantMap = new Map<string, { email: string | null; name: string | null }>();

      // Track unique hosts (by email) and their names
      const hostsSet = new Set<string>();
      const hostNameMap = new Map<string, string | null>();

      // Track guests separately for naming (Guest 1, Guest 2, etc.)
      const guestCounter = new Map<string, number>(); // Maps occupant_jid to guest number
      let guestNumber = 0;

      // Process events to extract participants and hosts
      for (const event of events) {
        const metadata = event.metadata as any;

        // Extract participants from occupant_joined events
        if (event.eventType === "occupant_joined" && metadata?.occupant) {
          const occupant = metadata.occupant;
          const email = occupant.email || null;
          const name = occupant.name || null;
          const occupantJid = occupant.occupant_jid || null;
          const affiliation = occupant.affiliation || null;
          const role = occupant.role || null;

          // Check if this occupant is a host (owner affiliation or moderator role)
          const isHost = affiliation === "owner" || role === "moderator";
          
          if (isHost && email) {
            // This is a host - add to hosts set and track their name
            hostsSet.add(email);
            if (name && !hostNameMap.has(email)) {
              hostNameMap.set(email, name);
            }
          }

          // Determine participant identifier
          let identifier: string | null = null;
          if (email) {
            // Authenticated user - use email
            identifier = email;
          } else if (occupantJid) {
            // Guest - assign friendly name
            if (!guestCounter.has(occupantJid)) {
              guestNumber++;
              guestCounter.set(occupantJid, guestNumber);
            }
            identifier = `Guest ${guestCounter.get(occupantJid)}`;
          } else if (name) {
            // Fallback to name if no email or JID
            identifier = name;
          }

          if (identifier) {
            participantsSet.add(identifier);
            if (!participantMap.has(identifier)) {
              participantMap.set(identifier, { email, name });
            }
          }
        }

        // Extract hosts from host_assigned events (fallback)
        if (event.eventType === "host_assigned" && metadata?.email) {
          hostsSet.add(metadata.email);
          // If we have a name in metadata, use it
          if (metadata.name && !hostNameMap.has(metadata.email)) {
            hostNameMap.set(metadata.email, metadata.name);
          }
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

      // Build host names array - use names from events if available, otherwise fall back to email prefix
      const hostNamesArray: string[] = [];
      if (hostsArray.length > 0) {
        for (const hostEmail of hostsArray) {
          // First try to use the name we extracted from events
          const extractedName = hostNameMap.get(hostEmail);
          if (extractedName) {
            hostNamesArray.push(extractedName);
          } else {
            // Fall back to formatting email prefix
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

      // Build participants array (emails when available, otherwise guest names)
      const participantsArray = Array.from(participantsSet);
      // Build participantNames array aligned with participantsArray
      const participantNamesArray: string[] = participantsArray.map((identifier) => {
        const meta = participantMap.get(identifier);
        // Prefer explicit name from metadata if available
        if (meta?.name) return meta.name;

        // If we have an email, format it nicely
        if (meta?.email) {
          const namePart = meta.email.split("@")[0];
          return namePart
            .split(".")
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(" ");
        }

        // Fallback: if identifier itself looks like an email, format from that
        if (identifier.includes("@") && !identifier.startsWith("Guest")) {
          const namePart = identifier.split("@")[0];
          return namePart
            .split(".")
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(" ");
        }

        // Otherwise use identifier as-is (covers "Guest 1", etc.)
        return identifier;
      });

      // Check if user participated in this meeting (as host or participant)
      const userParticipated = 
        hostsArray.includes(userEmail) || 
        participantsArray.includes(userEmail);

      // Only include meetings where the user participated
      if (!userParticipated) {
        continue;
      }

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
        participantNames: participantNamesArray,
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
