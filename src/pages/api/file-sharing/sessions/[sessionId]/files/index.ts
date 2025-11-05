import type { APIRoute } from "astro";
import { getLogger, logWrapper } from "../../../../../../lib/modules/pino-logger";
import { validateFileSharingToken, extractBearerToken } from "../../../../../../lib/file-sharing-auth";
import { uploadFile, validateFileSize, MAX_FILE_SIZE, type FileMetadata } from "../../../../../../lib/s3-client";
import { getCorsHeaders } from "../../../../../../lib/cors";

export const prerender = false;
const logger = getLogger();

export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(),
  });
};

export const POST: APIRoute = async (c) => {
  return await logWrapper(c, WorkerHandler);
};

/**
 * POST endpoint for uploading files to a meeting session.
 * 
 * Expects multipart/form-data with:
 * - metadata: JSON string containing FileMetadata
 * - file: Binary file data
 * 
 * Requires valid JWT token in Authorization header.
 */
const WorkerHandler: APIRoute = async ({ request, params }) => {
  try {
    // Extract sessionId from URL params
    const sessionId = params.sessionId;
    if (!sessionId) {
      logger.error("Missing sessionId in URL parameters");
      return new Response(JSON.stringify({ error: "Missing sessionId" }), {
        status: 400,
        headers: { 
          "Content-Type": "application/json",
          ...getCorsHeaders(),
        },
      });
    }

    // Extract and validate JWT token
    const authHeader = request.headers.get("Authorization");
    const token = extractBearerToken(authHeader);
    
    if (!token) {
      logger.error("Missing or invalid Authorization header");
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { 
          "Content-Type": "application/json",
          ...getCorsHeaders(),
        },
      });
    }

    const authResult = await validateFileSharingToken(token);
    if (!authResult.isValid) {
      logger.error({ error: authResult.error }, "Invalid JWT token");
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { 
          "Content-Type": "application/json",
          ...getCorsHeaders(),
        },
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
        headers: { 
          "Content-Type": "application/json",
          ...getCorsHeaders(),
        },
      });
    }

    // Parse multipart form data
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (error) {
      logger.error(error, "Failed to parse multipart form data");
      return new Response(JSON.stringify({ error: "Invalid form data" }), {
        status: 400,
        headers: { 
          "Content-Type": "application/json",
          ...getCorsHeaders(),
        },
      });
    }

    // Extract metadata and file
    const metadataJson = formData.get("metadata") as string;
    const fileBlob = formData.get("file") as Blob;

    if (!metadataJson || !fileBlob) {
      logger.error({
        hasMetadata: !!metadataJson,
        hasFile: !!fileBlob
      }, "Missing required form fields");
      return new Response(JSON.stringify({ error: "Missing metadata or file" }), {
        status: 400,
        headers: { 
          "Content-Type": "application/json",
          ...getCorsHeaders(),
        },
      });
    }

    // Parse and validate metadata
    let metadata: FileMetadata;
    try {
      metadata = JSON.parse(metadataJson);
    } catch (error) {
      logger.error(error, "Failed to parse metadata JSON");
      return new Response(JSON.stringify({ error: "Invalid metadata JSON" }), {
        status: 400,
        headers: { 
          "Content-Type": "application/json",
          ...getCorsHeaders(),
        },
      });
    }

    // Validate required metadata fields
    if (!metadata.fileId || !metadata.conferenceFullName || !metadata.timestamp || !metadata.fileSize) {
      logger.error({ metadata }, "Missing required metadata fields");
      return new Response(JSON.stringify({ error: "Missing required metadata fields" }), {
        status: 400,
        headers: { 
          "Content-Type": "application/json",
          ...getCorsHeaders(),
        },
      });
    }

    // Validate file size
    if (!validateFileSize(fileBlob.size)) {
      logger.error({ 
        size: fileBlob.size, 
        maxSize: MAX_FILE_SIZE 
      }, "File too large");
      return new Response(JSON.stringify({ 
        error: `File too large. Maximum size is ${MAX_FILE_SIZE} bytes` 
      }), {
        status: 413,
        headers: { 
          "Content-Type": "application/json",
          ...getCorsHeaders(),
        },
      });
    }

    // Verify metadata fileSize matches actual file size
    if (metadata.fileSize !== fileBlob.size) {
      logger.error({
        metadataSize: metadata.fileSize,
        actualSize: fileBlob.size
      }, "File size mismatch");
      return new Response(JSON.stringify({ error: "File size mismatch" }), {
        status: 400,
        headers: { 
          "Content-Type": "application/json",
          ...getCorsHeaders(),
        },
      });
    }

    // Upload file to S3
    const uploadSuccess = await uploadFile(sessionId, metadata.fileId, fileBlob, metadata);
    
    if (!uploadSuccess) {
      logger.error("Failed to upload file to S3");
      return new Response(JSON.stringify({ error: "Failed to upload file" }), {
        status: 500,
        headers: { 
          "Content-Type": "application/json",
          ...getCorsHeaders(),
        },
      });
    }

    logger.info({
      sessionId,
      fileId: metadata.fileId,
      fileName: metadata.fileName,
      fileSize: fileBlob.size,
      userId: payload.context.user.id
    }, "File uploaded successfully");

    // Return success response
    return new Response(JSON.stringify({ fileId: metadata.fileId }), {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        ...getCorsHeaders(),
      },
    });

  } catch (error) {
    logger.error(error, "Error in file upload handler");
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { 
        "Content-Type": "application/json",
        ...getCorsHeaders(),
      },
    });
  }
};
