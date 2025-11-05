import { PUBLIC_CF_ENV } from "astro:env/client";

/**
 * CORS headers for file-sharing API endpoints
 * Only enabled in staging environment, not in production
 */
export function getCorsHeaders(): Record<string, string> {
  // Only add CORS headers in staging environment
  if (PUBLIC_CF_ENV !== 'staging') {
    return {};
  }

  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400", // 24 hours
  };
}

/**
 * Create a response with CORS headers
 */
export function corsResponse(
  body: string | null,
  status: number = 200,
  additionalHeaders: Record<string, string> = {}
): Response {
  return new Response(body, {
    status,
    headers: {
      ...getCorsHeaders(),
      ...additionalHeaders,
    },
  });
}

