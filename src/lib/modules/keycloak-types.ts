export interface KeycloakTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_expires_in: number;
  token_type: string;
  scope: string;
}

export interface KeycloakUserAttributes {
  paddle_subscription_id?: string[];
  paddle_product_id?: string[];
  paddle_price_id?: string[];
  paddle_customer_id?: string[];
  paddle_last_update?: string[];
  paddle_subscription_status?: string[];
  paddle_quantity?: string[];
  paddle_collection_mode?: string[];
  // Add other attributes as discovered
}

export interface KeycloakUserAccess {
  manageGroupMembership: boolean;
  view: boolean;
  mapRoles: boolean;
  impersonate: boolean;
  manage: boolean;
}

export interface KeycloakUser {
  id: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  emailVerified?: boolean;
  attributes?: KeycloakUserAttributes;
  createdTimestamp?: number;
  enabled?: boolean;
  totp?: boolean;
  disableableCredentialTypes?: string[];
  requiredActions?: string[];
  notBefore?: number;
  access?: KeycloakUserAccess;
}

export interface KeycloakUserUpdate {
  firstName?: string;
  lastName?: string;
  email?: string;
  emailVerified?: boolean;
  enabled?: boolean;
  attributes?: Partial<KeycloakUserAttributes>;
}

export interface KeycloakOrganization {
  id: string;
  name: string;
  alias?: string;
  enabled?: boolean;
  description?: string;
  domains?: Array<{ name: string; verified?: boolean }>;
}
