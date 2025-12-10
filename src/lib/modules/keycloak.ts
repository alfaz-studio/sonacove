// Helper for validating Keycloak JWTs using JWKS
import { jwtVerify, createRemoteJWKSet } from "jose";
import { KC_CLIENT_ID, KC_CLIENT_SECRET } from "astro:env/server";
import type {
  KeycloakTokenResponse,
  KeycloakUser,
  KeycloakUserUpdate,
} from "./keycloak-types";
import { getLogger } from "./pino-logger";
import { PUBLIC_KC_HOSTNAME } from "astro:env/client";

const logger = getLogger();

const tokenEndpoint = "/realms/jitsi/protocol/openid-connect/token";
const userEndpoint = "/admin/realms/jitsi/users/";
const orgsEndpoint = "/admin/realms/jitsi/organizations";
const userOrgsEndpoint = "/admin/realms/jitsi/organizations/members";

const tokenKey = "keycloak_token";
const tokenExpiryKey = "keycloak_token_expiry";

const JWKS_URL = "/realms/jitsi/protocol/openid-connect/certs";
const ISSUER = "/realms/jitsi";
const AUDIENCE = "jitsi-web";


export class KeycloakClient {
  private token?: string;
  private KV;
  private jwks: any;

  constructor(runtime: Runtime["runtime"]) {
    this.KV = runtime.env.KV;
  }

  private async saveToken(
    this: KeycloakClient,
    token: string,
    expiresIn: number
  ) {
    try {
      // Cache the token and its expiry time
      const expiryTime = Date.now() + expiresIn * 1000;
      await this.KV.put(tokenKey, token);
      await this.KV.put(tokenExpiryKey, expiryTime.toString());
    } catch (e) {
      logger.error(e, "Error saving Keycloak token:");
      throw e;
    }
  }

  private async getToken(this: KeycloakClient): Promise<string | null> {
    try {
      // Check if we have a cached token in KV
      const cachedToken = await this.KV.get(tokenKey);
      const cachedExpiry = await this.KV.get(tokenExpiryKey);

      // If we have a cached token and it's not expired, use it
      if (cachedToken && cachedExpiry) {
        const expiryTime = parseInt(cachedExpiry);
        // Add a 60-second buffer to ensure we don't use an about-to-expire token
        if (Date.now() < expiryTime - 60000) {
          return cachedToken;
        }
      }

      // Return null if no valid token is found
      return null;
    } catch (e) {
      logger.error(e, "Error getting Keycloak token:");
      throw e;
    }
  }

  private async fetchToken(this: KeycloakClient) {
    try {
      // Try to get the token from the cache
      const cachedToken = await this.getToken();
      if (cachedToken) this.token = cachedToken;

      // Otherwise, get a new token
      const formData = new URLSearchParams();
      formData.append("grant_type", "client_credentials");
      formData.append("client_id", KC_CLIENT_ID);
      formData.append("client_secret", KC_CLIENT_SECRET);

      const url = "https://" + PUBLIC_KC_HOSTNAME + tokenEndpoint;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get Keycloak token: ${error}`);
      }
      const data = (await response.json()) as KeycloakTokenResponse;
      await this.saveToken(data.access_token, data.expires_in);

      this.token = data.access_token;
    } catch (e) {
      logger.error(e, "Error fetching Keycloak token:");
      throw e;
    }
  }

  async getUser(
    this: KeycloakClient,
    email?: string,
    subscriptionId?: string
  ): Promise<KeycloakUser | null> {
    try {
      if (!email && !subscriptionId)
        throw new Error("Either email or subscriptionId must be provided");
      if (!this.token) await this.fetchToken();
      if (!this.token) throw new Error("Failed to get Keycloak token");

      // Use either email or subscriptionId to get the user
      // giving preference to email
      const query = email
        ? `?email=${encodeURIComponent(email)}`
        : `?q=paddle_subscription_id:${subscriptionId}`;
      const url = "https://" + PUBLIC_KC_HOSTNAME + userEndpoint + query;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get Keycloak user: ${error}`);
      }
      const data = (await response.json()) as KeycloakUser[];

      // Return the first matching user, if any
      return data.length > 0 ? data[0] : null;
    } catch (e) {
      logger.error(e, "Error getting Keycloak user:");
      return null;
    }
  }

  async updateUser(
    this: KeycloakClient,
    user: KeycloakUser,
    attributes: KeycloakUserUpdate
  ): Promise<boolean> {
    try {
      if (!this.token) await this.fetchToken();
      if (!this.token) throw new Error("Failed to get Keycloak token");

      // Create a deep copy of the user object
      const userData = { ...user };

      // If there are attributes to update
      if (attributes.attributes && userData.attributes) {
        // For each attribute in the update
        for (const [key, value] of Object.entries(attributes.attributes)) {
          if (value !== undefined) {
            // Update the specific attribute
            userData.attributes[key as keyof typeof userData.attributes] = value;
          }
        }
      } else if (attributes.attributes) {
        // If the user doesn't have attributes yet, but we're adding some
        userData.attributes = attributes.attributes;
      }

      // Update non-attribute fields if provided
      if (attributes.firstName !== undefined)
        userData.firstName = attributes.firstName;
      if (attributes.lastName !== undefined)
        userData.lastName = attributes.lastName;
      if (attributes.email !== undefined) userData.email = attributes.email;
      if (attributes.emailVerified !== undefined)
        userData.emailVerified = attributes.emailVerified;
      if (attributes.enabled !== undefined) userData.enabled = attributes.enabled;

      // Send the update
      const url = "https://" + PUBLIC_KC_HOSTNAME + userEndpoint + user.id;
      const updateResponse = await fetch(url, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      });

      if (!updateResponse.ok) {
        const error = await updateResponse.text();
        throw new Error(`Failed to update user: ${error}`);
      }
      return true;
    } catch (e) {
      logger.error(e, "Error updating Keycloak user:");
      return false;
    }
  }

  async validateToken(this: KeycloakClient, token: string) {
    try {
      if (!this.jwks) {
        this.jwks = createRemoteJWKSet(new URL("https://" + PUBLIC_KC_HOSTNAME + JWKS_URL));
      }
      await jwtVerify(token, this.jwks, {
        issuer: "https://" + PUBLIC_KC_HOSTNAME + ISSUER,
        audience: AUDIENCE,
      });
      // Optionally check exp, email_verified, etc. here
      return true;
    } catch (e) {
      logger.error(e, "JWT validation failed:");
      return false;
    }
  }

  // Potentially expensive operation. Avoid using until pagination is added.
  async getAllUsers(this: KeycloakClient): Promise<KeycloakUser[]> {
    try {
      if (!this.token) await this.fetchToken();
      if (!this.token) throw new Error("Failed to get Keycloak token");

      const url = "https://" + PUBLIC_KC_HOSTNAME + userEndpoint;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get all Keycloak users: ${error}`);
      }

      const users = (await response.json()) as KeycloakUser[];
      logger.info(`Retrieved ${users.length} users from Keycloak`);
      return users;
    } catch (e) {
      logger.error(e, "Error getting all Keycloak users:");
      return [];
    }
  }

  /**
   * Deletes a user from Keycloak by user ID
   * @param userId The ID of the user to delete
   * @returns Whether the deletion was successful
   */
  async deleteUser(this: KeycloakClient, userId: string): Promise<boolean> {
    try {
      if (!this.token) await this.fetchToken();
      if (!this.token) throw new Error("Failed to get Keycloak token");

      const url = "https://" + PUBLIC_KC_HOSTNAME + userEndpoint + userId;
      const response = await fetch(url, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error(`Failed to delete Keycloak user ${userId}: ${response.status} ${error}`);
        return false;
      }

      logger.info(`Successfully deleted Keycloak user ${userId}`);
      return true;
    } catch (e) {
      logger.error(e, `Error deleting Keycloak user ${userId}:`);
      return false;
    }
  }

  /**
   * Organization helpers (Keycloak Organizations API, KC 26.4+)
   */
  async createOrganization(this: KeycloakClient, params: {
    name: string;
    alias?: string;
    domains?: string[];
    description?: string;
    enabled?: boolean;
  }): Promise<{ id: string; alias: string } | null> {
    try {
      if (!this.token) await this.fetchToken();
      if (!this.token) throw new Error("Failed to get Keycloak token");

      const payload = {
        name: params.name,
        alias: params.alias ?? params.name,
        enabled: params.enabled ?? true,
        description: params.description,
        domains: (params.domains ?? []).map((d) => ({ name: d })),
      };

      const url = "https://" + PUBLIC_KC_HOSTNAME + orgsEndpoint;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.status !== 201 && response.status !== 204) {
        const error = await response.text();
        throw new Error(`Failed to create org: ${response.status} ${error}`);
      }

      const location = response.headers.get("Location") ?? "";
      const id = location ? location.split("/").filter(Boolean).pop() : undefined;

      return {
        id: id ?? payload.alias,
        alias: payload.alias,
      };
    } catch (e) {
      logger.error(e, "Error creating Keycloak organization:");
      return null;
    }
  }

  async listUserOrganizations(this: KeycloakClient, userId: string) {
    try {
      if (!this.token) await this.fetchToken();
      if (!this.token) throw new Error("Failed to get Keycloak token");

      const url =
        "https://" +
        PUBLIC_KC_HOSTNAME +
        `${userOrgsEndpoint}/${userId}/organizations?briefRepresentation=true`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to list user orgs: ${error}`);
      }
      return (await response.json()) as Array<{ id: string; name: string; alias: string }>;
    } catch (e) {
      logger.error(e, "Error listing user organizations:");
      return [];
    }
  }

  async getOrganizationMembers(this: KeycloakClient, orgId: string) {
    try {
      if (!this.token) await this.fetchToken();
      if (!this.token) throw new Error("Failed to get Keycloak token");

      const url = "https://" + PUBLIC_KC_HOSTNAME + `${orgsEndpoint}/${orgId}/members`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get org members: ${error}`);
      }
      return (await response.json()) as KeycloakUser[];
    } catch (e) {
      logger.error(e, "Error getting organization members:");
      return [];
    }
  }

  async addMemberToOrganization(this: KeycloakClient, orgId: string, userId: string) {
    try {
      if (!this.token) await this.fetchToken();
      if (!this.token) throw new Error("Failed to get Keycloak token");

      const url = "https://" + PUBLIC_KC_HOSTNAME + `${orgsEndpoint}/${orgId}/members`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userId),
      });

      if (!response.ok && response.status !== 204 && response.status !== 201) {
        const error = await response.text();
        throw new Error(`Failed to add member: ${response.status} ${error}`);
      }
      return true;
    } catch (e) {
      logger.error(e, "Error adding member to organization:");
      return false;
    }
  }

  async removeMemberFromOrganization(this: KeycloakClient, orgId: string, userId: string) {
    try {
      if (!this.token) await this.fetchToken();
      if (!this.token) throw new Error("Failed to get Keycloak token");

      const url =
        "https://" +
        PUBLIC_KC_HOSTNAME +
        `${orgsEndpoint}/${orgId}/members/${userId}`;
      const response = await fetch(url, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      if (!response.ok && response.status !== 204) {
        const error = await response.text();
        throw new Error(`Failed to remove member: ${response.status} ${error}`);
      }
      return true;
    } catch (e) {
      logger.error(e, "Error removing member from organization:");
      return false;
    }
  }
}
