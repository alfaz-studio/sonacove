import type { APIRoute } from "astro";
import { getLogger, logWrapper } from "../../../../../../lib/modules/pino-logger";
import { validateFileSharingToken, extractBearerToken } from "../../../../../../lib/file-sharing-auth";
import { generatePresignedUrl, deleteFile, fileExists } from "../../../../../../lib/s3-client";

export const prerender = false;
const logger = getLogger();

export const GET: APIRoute = async (c) => {
  return await logWrapper(c, GetWorkerHandler);
};

export const DELETE: APIRoute = async (c) => {
  return await logWrapper(c, DeleteWorkerHandler);
};

/**
 * GET endpoint for generating presigned download URLs.
 * 
 * Requires valid JWT token in Authorization header.
 * Returns presigned URL that expires in 24 hours.
 */
const GetWorkerHandler: APIRoute = async ({ request, params }) => {
  try {
    // Extract sessionId and fileId from URL params
    const sessionId = params.sessionId;
    const fileId = params.fileId;
    
    if (!sessionId || !fileId) {
      logger.error({ sessionId, fileId }, "Missing sessionId or fileId in URL parameters");
      return new Response(JSON.stringify({ error: "Missing sessionId or fileId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Extract and validate JWT token
    const authHeader = request.headers.get("Authorization");
    const token = extractBearerToken(authHeader);
    
    if (!token) {
      logger.error("Missing or invalid Authorization header");
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const authResult = await validateFileSharingToken(token);
    if (!authResult.isValid) {
      logger.error({ error: authResult.error }, "Invalid JWT token");
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const payload = authResult.payload!;

    // Verify the sessionId matches the meeting_id in the token
    if (payload.meeting_id !== sessionId) {
      logger.error({ 
        sessionId, 
        meeting_id: payload.meeting_id 
      }, "SessionId mismatch");
      return new Response(JSON.stringify({ error: "SessionId mismatch" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check if file exists
    const exists = await fileExists(sessionId, fileId);
    if (!exists) {
      logger.warn({ sessionId, fileId }, "File not found");
      return new Response(JSON.stringify({ error: "File not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Generate presigned URL (24 hours expiry)
    const presignedUrl = await generatePresignedUrl(sessionId, fileId, 24);
    
    if (!presignedUrl) {
      logger.error({ sessionId, fileId }, "Failed to generate presigned URL");
      return new Response(JSON.stringify({ error: "Failed to generate download URL" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    logger.info({
      sessionId,
      fileId,
      userId: payload.context.user.id
    }, "Presigned URL generated");

    // Return presigned URL and filename
    return new Response(JSON.stringify({ 
      fileName: fileId, // We don't store original filename, so use fileId
      presignedUrl 
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    logger.error(error, "Error in file download handler");
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

/**
 * DELETE endpoint for removing files from storage.
 * 
 * Requires valid JWT token in Authorization header.
 * Only allows deletion by meeting participants.
 */
const DeleteWorkerHandler: APIRoute = async ({ request, params }) => {
  try {
    // Extract sessionId and fileId from URL params
    const sessionId = params.sessionId;
    const fileId = params.fileId;
    
    if (!sessionId || !fileId) {
      logger.error({ sessionId, fileId }, "Missing sessionId or fileId in URL parameters");
      return new Response(JSON.stringify({ error: "Missing sessionId or fileId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Extract and validate JWT token
    const authHeader = request.headers.get("Authorization");
    const token = extractBearerToken(authHeader);
    
    if (!token) {
      logger.error("Missing or invalid Authorization header");
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const authResult = await validateFileSharingToken(token);
    if (!authResult.isValid) {
      logger.error({ error: authResult.error }, "Invalid JWT token");
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const payload = authResult.payload!;

    // Verify the sessionId matches the meeting_id in the token
    if (payload.meeting_id !== sessionId) {
      logger.error({ 
        sessionId, 
        meeting_id: payload.meeting_id 
      }, "SessionId mismatch");
      return new Response(JSON.stringify({ error: "SessionId mismatch" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check if file exists before attempting deletion
    const exists = await fileExists(sessionId, fileId);
    if (!exists) {
      logger.warn({ sessionId, fileId }, "File not found for deletion");
      return new Response(JSON.stringify({ error: "File not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Delete file from S3
    const deleteSuccess = await deleteFile(sessionId, fileId);
    
    if (!deleteSuccess) {
      logger.error({ sessionId, fileId }, "Failed to delete file from S3");
      return new Response(JSON.stringify({ error: "Failed to delete file" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    logger.info({
      sessionId,
      fileId,
      userId: payload.context.user.id
    }, "File deleted successfully");

    // Return success response (200 OK with empty body)
    return new Response(null, { status: 200 });

  } catch (error) {
    logger.error(error, "Error in file deletion handler");
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
