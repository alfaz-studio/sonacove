import { S3Client, DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getLogger } from "./modules/pino-logger";
import { S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET, S3_ENDPOINT, S3_REGION } from "astro:env/server";
import { DOMParser as XmldomDOMParser } from "@xmldom/xmldom";

// Polyfill Node constants for Cloudflare Workers (@xmldom/xmldom requires these)
// These are DOM node type constants used by xmldom for XML parsing
if (typeof globalThis.Node === "undefined") {
  // @ts-ignore - Node constants needed by xmldom
  globalThis.Node = {
    ELEMENT_NODE: 1,
    ATTRIBUTE_NODE: 2,
    TEXT_NODE: 3,
    CDATA_SECTION_NODE: 4,
    ENTITY_REFERENCE_NODE: 5,
    ENTITY_NODE: 6,
    PROCESSING_INSTRUCTION_NODE: 7,
    COMMENT_NODE: 8,
    DOCUMENT_NODE: 9,
    DOCUMENT_TYPE_NODE: 10,
    DOCUMENT_FRAGMENT_NODE: 11,
    NOTATION_NODE: 12,
  };
}

// Polyfill DOMParser for Cloudflare Workers (AWS SDK requires it for XML error parsing)
// The AWS SDK uses DOMParser to parse XML error responses from S3
if (typeof globalThis.DOMParser === "undefined") {
  // @ts-ignore - DOMParser from xmldom has a slightly different interface but is compatible
  globalThis.DOMParser = XmldomDOMParser;
}

const logger = getLogger();

// Maximum file size: 50MB (matching config.js default)
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

export interface S3Config {
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint: string;
}

export interface FileMetadata {
  fileId: string;
  conferenceFullName: string;
  timestamp: number;
  fileSize: number;
  fileName?: string;
  fileType?: string;
  authorParticipantId?: string;
  authorParticipantJid?: string;
  authorParticipantName?: string;
}

/**
 * Extracts region from S3-compatible endpoint (e.g., https://in-maa-1.linodeobjects.com -> in-maa-1).
 * Falls back to us-east-1 if region cannot be determined.
 * This is only used as a fallback if S3_REGION is not provided.
 */
function extractRegionFromEndpoint(endpoint: string): string {
  // Extract region from Linode/Akamai format: {region}.linodeobjects.com
  // Handle both with and without https:// prefix
  // Match pattern like: in-maa-1, us-east-1, etc. (can have multiple dashes)
  const linodeMatch = endpoint.match(/(?:https?:\/\/)?([a-z0-9-]+)\.linodeobjects\.com/);
  if (linodeMatch) {
    return linodeMatch[1];
  }

  // For AWS endpoints, try to extract region
  const awsMatch = endpoint.match(/\.([a-z0-9-]+)\.amazonaws\.com/);
  if (awsMatch) {
    return awsMatch[1];
  }

  // Default fallback for S3-compatible storage
  return "us-east-1";
}

/**
 * Creates and configures an S3 client using AWS SDK for S3-compatible storage.
 * Uses environment variables for configuration.
 */
export function createS3Client(): S3Client {
  const config: S3Config = {
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
    bucket: S3_BUCKET,
    endpoint: S3_ENDPOINT,
  };

  // Use S3_REGION if provided, otherwise try to extract from endpoint
  const region = S3_REGION || extractRegionFromEndpoint(config.endpoint);

  logger.info({
    bucket: config.bucket,
    endpoint: config.endpoint,
    region,
    hasCredentials: !!(config.accessKeyId && config.secretAccessKey)
  }, "Creating S3 client (AWS SDK for S3-compatible storage)");

  return new S3Client({
    region,
    endpoint: config.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

/**
 * Uploads a file to S3 storage.
 * 
 * @param sessionId - The meeting session ID
 * @param fileId - The unique file ID
 * @param fileBlob - The file data as a Blob
 * @param metadata - File metadata
 * @returns Promise<boolean> - Success status
 */
export async function uploadFile(
  sessionId: string,
  fileId: string,
  fileBlob: Blob,
  metadata: FileMetadata
): Promise<boolean> {
  try {
    const s3 = createS3Client();
    const key = `${sessionId}/${fileId}`;

    logger.info({
      key,
      size: fileBlob.size,
      fileName: metadata.fileName
    }, "Uploading file to S3");

    // Convert Blob to Uint8Array for S3 upload
    // The AWS SDK accepts ArrayBuffer/Uint8Array directly (works in Cloudflare Workers)
    // Using Uint8Array instead of Buffer for better compatibility
    const arrayBuffer = await fileBlob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    await s3.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: uint8Array,
      ContentLength: uint8Array.length,
      ContentType: fileBlob.type || metadata.fileType || "application/octet-stream",
      // Store original filename in metadata for retrieval during download
      Metadata: {
        ...(metadata.fileName && { 'original-filename': metadata.fileName }),
        ...(metadata.fileType && { 'original-filetype': metadata.fileType }),
      },
    }));

    logger.info({ key }, "File uploaded successfully");
    return true;

  } catch (error: any) {
    // Extract detailed error information from AWS SDK errors
    const errorDetails: any = {
      sessionId,
      fileId,
      size: fileBlob.size,
      fileName: metadata.fileName,
    };

    // Try to extract HTTP status code and error message
    if (error.$metadata) {
      errorDetails.httpStatusCode = error.$metadata.httpStatusCode;
      errorDetails.requestId = error.$metadata.requestId;
    }

    if (error.name) {
      errorDetails.errorName = error.name;
    }

    if (error.message) {
      errorDetails.errorMessage = error.message;
    }

    // Log the full error object for debugging
    logger.error({
      ...errorDetails,
      error: error,
      stack: error.stack,
    }, "Failed to upload file to S3");

    return false;
  }
}

/**
 * Generates a presigned URL for downloading a file from S3.
 * 
 * @param sessionId - The meeting session ID
 * @param fileId - The unique file ID
 * @param expiresInHours - URL expiry time in hours (default: 24)
 * @returns Promise<{ url: string | null; fileName: string | null }> - Presigned URL and original filename
 */
export async function generatePresignedUrl(
  sessionId: string,
  fileId: string,
  expiresInHours: number = 24
): Promise<{ url: string | null; fileName: string | null }> {
  try {
    const s3 = createS3Client();
    const key = `${sessionId}/${fileId}`;

    logger.info({ key, expiresInHours }, "Generating presigned URL");

    // Check existence and retrieve metadata via HeadObject
    let fileName: string | null = null;
    try {
      const headResponse = await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }));
      // Retrieve original filename from metadata
      fileName = headResponse.Metadata?.['original-filename'] || null;
    } catch (err) {
      logger.warn({ key }, "File not found in S3");
      return { url: null, fileName: null };
    }

    const command = new GetObjectCommand({ Bucket: S3_BUCKET, Key: key });
    const url = await getSignedUrl(s3, command, { expiresIn: expiresInHours * 60 * 60 });

    logger.info({ key, url, fileName }, "Presigned URL generated");
    return { url, fileName };

  } catch (error: any) {
    const errorDetails: any = {
      sessionId,
      fileId,
    };

    if (error.$metadata) {
      errorDetails.httpStatusCode = error.$metadata.httpStatusCode;
      errorDetails.requestId = error.$metadata.requestId;
    }

    if (error.name) {
      errorDetails.errorName = error.name;
    }

    if (error.message) {
      errorDetails.errorMessage = error.message;
    }

    logger.error({
      ...errorDetails,
      error: error,
      stack: error.stack,
    }, "Failed to generate presigned URL");
    return { url: null, fileName: null };
  }
}

/**
 * Deletes a file from S3 storage.
 * 
 * @param sessionId - The meeting session ID
 * @param fileId - The unique file ID
 * @returns Promise<boolean> - Success status
 */
export async function deleteFile(sessionId: string, fileId: string): Promise<boolean> {
  try {
    const s3 = createS3Client();
    const key = `${sessionId}/${fileId}`;

    logger.info({ key }, "Deleting file from S3");

    await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));

    logger.info({ key }, "File deleted successfully");
    return true;

  } catch (error: any) {
    const errorDetails: any = {
      sessionId,
      fileId,
    };

    if (error.$metadata) {
      errorDetails.httpStatusCode = error.$metadata.httpStatusCode;
      errorDetails.requestId = error.$metadata.requestId;
    }

    if (error.name) {
      errorDetails.errorName = error.name;
    }

    if (error.message) {
      errorDetails.errorMessage = error.message;
    }

    logger.error({
      ...errorDetails,
      error: error,
      stack: error.stack,
    }, "Failed to delete file from S3");
    return false;
  }
}

/**
 * Checks if a file exists in S3 storage.
 * 
 * @param sessionId - The meeting session ID
 * @param fileId - The unique file ID
 * @returns Promise<boolean> - File existence status
 */
export async function fileExists(sessionId: string, fileId: string): Promise<boolean> {
  try {
    const s3 = createS3Client();
    const key = `${sessionId}/${fileId}`;

    try {
      await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }));
      logger.debug({ key, exists: true }, "File existence check");
      return true;
    } catch (err) {
      logger.debug({ key, exists: false }, "File existence check");
      return false;
    }

  } catch (error) {
    logger.error(error, "Failed to check file existence", {
      sessionId,
      fileId
    });
    return false;
  }
}

/**
 * Validates file size against the maximum allowed size.
 * 
 * @param fileSize - The file size in bytes
 * @returns boolean - Whether the file size is valid
 */
export function validateFileSize(fileSize: number): boolean {
  return fileSize > 0 && fileSize <= MAX_FILE_SIZE;
}
