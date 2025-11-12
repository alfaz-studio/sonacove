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
      id?: string;
      name?: string;
      email?: string;
      nick?: string;
    };
    /**
     * Prosody issues file-sharing tokens with a map of feature flags (boolean values) rather than an array.
     * Keep this permissive to avoid validation failures when new flags are added.
     */
    features?: Record<string, boolean> | string[];
  };
  room: string;
  meeting_id: string;
  granted_from?: string;
  customer_id?: string;
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
    let publicKeyPem = FILE_SHARING_JWT_PUBLIC_KEY;

    // Normalize PEM format for Cloudflare Workers
    // Cloudflare env vars may have newlines escaped as literal \n strings
    // Ensure proper PEM format with actual newlines
    if (!publicKeyPem || publicKeyPem.trim().length === 0) {
      logger.error("FILE_SHARING_JWT_PUBLIC_KEY is empty or undefined");
      return { isValid: false, error: "Public key not configured" };
    }

    // First, convert literal \n escape sequences to actual newlines
    // This handles cases where the env var is stored with \n as a string
    publicKeyPem = publicKeyPem.replace(/\\n/g, '\n');

    // If still no newlines after conversion, reconstruct from single line
    // This handles cases where the key is stored as a single concatenated line
    // (e.g., "-----BEGIN PUBLIC KEY-----MIIBIj...-----END PUBLIC KEY-----")
    if (!publicKeyPem.includes('\n')) {
      // Remove any existing whitespace and headers
      const keyContent = publicKeyPem
        .replace(/-----BEGIN PUBLIC KEY-----/g, '')
        .replace(/-----END PUBLIC KEY-----/g, '')
        .replace(/\s+/g, '')
        .trim();
      
      if (keyContent.length === 0) {
        logger.error("Public key content is empty after normalization");
        return { isValid: false, error: "Invalid public key format" };
      }
      
      // Reconstruct with proper newlines (64 chars per line)
      const lines: string[] = [];
      for (let i = 0; i < keyContent.length; i += 64) {
        lines.push(keyContent.slice(i, i + 64));
      }
      
      publicKeyPem = `-----BEGIN PUBLIC KEY-----\n${lines.join('\n')}\n-----END PUBLIC KEY-----`;
    }

    // Validate PEM format
    if (!publicKeyPem.includes('-----BEGIN PUBLIC KEY-----') || !publicKeyPem.includes('-----END PUBLIC KEY-----')) {
      logger.error("Public key missing PEM headers");
      return { isValid: false, error: "Invalid public key format: missing PEM headers" };
    }

    // Import the public key
    const publicKey = await importSPKI(publicKeyPem, "RS256");

    // Verify the token
    // jwtVerify automatically validates:
    // - Signature (using the public key)
    // - Expiry (exp claim)
    // - Not before (nbf claim)
    // - Audience (aud claim)
    // - Issuer (iss claim)
    const { payload } = await jwtVerify(token, publicKey, {
      audience: "file-sharing",
      issuer: "prosody",
    });

    // Type assertion to our expected payload structure
    const typedPayload = payload as unknown as FileSharingTokenPayload;

    // Additional validation
    if (!typedPayload.meeting_id || !typedPayload.room) {
      logger.warn({ 
        meeting_id: typedPayload.meeting_id,
        room: typedPayload.room,
        customer_id: typedPayload.customer_id
      }, "Token missing required fields");
      return { isValid: false, error: "Token missing required fields" };
    }

    const userId =
      typedPayload.context?.user?.id
      ?? typedPayload.context?.user?.email
      ?? typedPayload.context?.user?.name
      ?? typedPayload.context?.user?.nick
      ?? "unknown-user";

    logger.info({
      meeting_id: typedPayload.meeting_id,
      room: typedPayload.room,
      customer_id: typedPayload.customer_id,
      user_id: userId
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
