import { S3Client, DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getLogger } from "./modules/pino-logger";
import { S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET, S3_ENDPOINT } from "astro:env/server";

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
 * Extracts region from S3-compatible endpoint (e.g., in-maa-1.linodeobjects.com -> in-maa-1).
 * Falls back to us-east-1 if region cannot be determined.
 */
function extractRegionFromEndpoint(endpoint: string): string {
  // Extract region from Linode/Akamai format: {region}.linodeobjects.com
  const linodeMatch = endpoint.match(/^([a-z]+-[a-z0-9]+)\.linodeobjects\.com/);
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

  const region = extractRegionFromEndpoint(config.endpoint);

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

    // Convert Blob to Buffer for S3 upload
    // The AWS SDK needs a Buffer/ArrayBuffer, not a Blob stream
    const arrayBuffer = await fileBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await s3.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: fileBlob.type || metadata.fileType || "application/octet-stream",
    }));

    logger.info({ key }, "File uploaded successfully");
    return true;

  } catch (error) {
    logger.error(error, "Failed to upload file to S3", {
      sessionId,
      fileId,
      size: fileBlob.size
    });
    return false;
  }
}

/**
 * Generates a presigned URL for downloading a file from S3.
 * 
 * @param sessionId - The meeting session ID
 * @param fileId - The unique file ID
 * @param expiresInHours - URL expiry time in hours (default: 24)
 * @returns Promise<string | null> - Presigned URL or null if file doesn't exist
 */
export async function generatePresignedUrl(
  sessionId: string,
  fileId: string,
  expiresInHours: number = 24
): Promise<string | null> {
  try {
    const s3 = createS3Client();
    const key = `${sessionId}/${fileId}`;

    logger.info({ key, expiresInHours }, "Generating presigned URL");

    // Check existence via HeadObject
    try {
      await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    } catch (err) {
      logger.warn({ key }, "File not found in S3");
      return null;
    }

    const command = new GetObjectCommand({ Bucket: S3_BUCKET, Key: key });
    const url = await getSignedUrl(s3, command, { expiresIn: expiresInHours * 60 * 60 });

    logger.info({ key, url }, "Presigned URL generated");
    return url;

  } catch (error) {
    logger.error(error, "Failed to generate presigned URL", {
      sessionId,
      fileId
    });
    return null;
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

  } catch (error) {
    logger.error(error, "Failed to delete file from S3", {
      sessionId,
      fileId
    });
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
