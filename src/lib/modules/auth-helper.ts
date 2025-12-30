import { KeycloakClient } from "./keycloak";
import { getEmailFromJWT } from "./jwt";
import { getLogger } from "./pino-logger";
import type { KeycloakUser } from "./keycloak-types";

const logger = getLogger();

export interface AuthResult {
  email: string;
  keycloakClient: KeycloakClient;
  kcUser: KeycloakUser;
}

/**
 * Validates JWT token and returns authenticated user information.
 * Returns null if authentication fails, along with an appropriate error response.
 */
export async function validateAuth(
  request: Request,
  runtime: Runtime["runtime"],
): Promise<{ result: AuthResult; error: null } | { result: null; error: Response }> {
  const authHeader = request.headers.get("Authorization");
  const bearerToken = authHeader?.replace("Bearer ", "");

  if (!bearerToken) {
    return {
      result: null,
      error: jsonError("Missing Authorization header", 401),
    };
  }

  const email = getEmailFromJWT(bearerToken);
  if (!email) {
    return {
      result: null,
      error: jsonError("Invalid token - no email found", 401),
    };
  }

  const keycloakClient = new KeycloakClient(runtime);
  const isValidToken = await keycloakClient.validateToken(bearerToken);
  if (!isValidToken) {
    return {
      result: null,
      error: jsonError("Invalid token", 401),
    };
  }

  const kcUser = await keycloakClient.getUser(email);
  if (!kcUser?.id) {
    logger.warn(`Keycloak user not found for email: ${email}`);
    return {
      result: null,
      error: jsonError("Keycloak user not found", 404),
    };
  }

  return {
    result: {
      email,
      keycloakClient,
      kcUser,
    },
    error: null,
  };
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
