import { jwtVerify, importSPKI } from "jose";
import { getLogger } from "./modules/pino-logger";
import { FILE_SHARING_JWT_PUBLIC_KEY } from "astro:env/server";

const logger = getLogger();

export interface FileSharingTokenPayload {
  iss: string;
  aud: string;
  exp: number;
  nbf: number;
  sub: string;
  context: {
    group?: string;
    user: {
      id: string;
      name: string;
      email?: string;
      nick: string;
    };
    features?: string[];
  };
  room: string;
  meeting_id: string;
  granted_from?: string;
  customer_id: string;
  backend_region?: string;
  user_region?: string;
}

export interface FileSharingAuthResult {
  isValid: boolean;
  payload?: FileSharingTokenPayload;
  error?: string;
}

/**
 * Validates a JWT token for file sharing operations.
 * 
 * @param token - The JWT token to validate
 * @returns Promise<FileSharingAuthResult> - Validation result with payload if valid
 */
export async function validateFileSharingToken(token: string): Promise<FileSharingAuthResult> {
  try {
    // Get public key from Astro environment
    const publicKeyPem = FILE_SHARING_JWT_PUBLIC_KEY;

    // Import the public key
    const publicKey = await importSPKI(publicKeyPem, "RS256");

    // Verify the token
    const { payload } = await jwtVerify(token, publicKey, {
      audience: "file-sharing",
      issuer: "prosody",
    });

    // Type assertion to our expected payload structure
    const typedPayload = payload as unknown as FileSharingTokenPayload;

    // Additional validation
    if (!typedPayload.meeting_id || !typedPayload.room || !typedPayload.customer_id) {
      logger.warn({ 
        meeting_id: typedPayload.meeting_id,
        room: typedPayload.room,
        customer_id: typedPayload.customer_id
      }, "Token missing required fields");
      return { isValid: false, error: "Token missing required fields" };
    }

    logger.info({
      meeting_id: typedPayload.meeting_id,
      room: typedPayload.room,
      customer_id: typedPayload.customer_id,
      user_id: typedPayload.context.user.id
    }, "Token validated successfully");

    return { isValid: true, payload: typedPayload };

  } catch (error) {
    logger.error(error, "JWT validation failed");
    return { 
      isValid: false, 
      error: error instanceof Error ? error.message : "Unknown validation error" 
    };
  }
}

/**
 * Extracts the Bearer token from the Authorization header.
 * 
 * @param authHeader - The Authorization header value
 * @returns string | null - The token or null if not found/invalid format
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}
