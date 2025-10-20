import { S3Client } from "bun";
import { getLogger } from "./modules/pino-logger";

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
 * Creates and configures an S3 client using Bun's native S3 API.
 * Uses environment variables for configuration.
 */
export function createS3Client(): S3Client {
  const config: S3Config = {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "dummy-access-key",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "dummy-secret-key",
    bucket: process.env.S3_BUCKET || "file-sharing-bucket",
    endpoint: process.env.S3_ENDPOINT || "https://s3.amazonaws.com",
  };

  logger.info({
    bucket: config.bucket,
    endpoint: config.endpoint,
    hasCredentials: !!(config.accessKeyId && config.secretAccessKey)
  }, "Creating S3 client");

  return new S3Client(config);
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

    // Upload the file
    await s3.write(key, fileBlob, {
      type: fileBlob.type || "application/octet-stream",
    });

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

    // Check if file exists first
    const exists = await s3.exists(key);
    if (!exists) {
      logger.warn({ key }, "File not found in S3");
      return null;
    }

    // Generate presigned URL (synchronous operation in Bun)
    const url = s3.presign(key, {
      expiresIn: expiresInHours * 60 * 60, // Convert hours to seconds
      method: "GET",
    });

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

    await s3.delete(key);

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
    
    const exists = await s3.exists(key);
    logger.debug({ key, exists }, "File existence check");
    return exists;

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
