import { getLogger } from "../../lib/modules/pino-logger";
import { BREVO_API_KEY } from "astro:env/server";

const logger = getLogger();

const apiEndpoint = "https://api.brevo.com/v3/contacts/";

// Define types for Brevo contact attributes
export interface BrevoContactAttributes {
  LASTNAME?: string;
  FIRSTNAME?: string;
  SMS?: string;
  EXT_ID?: string;
  WHATSAPP?: string;
  EMAIL?: string;
  "CONTACT OWNER"?: string;
  "DOUBLE_OPT-IN"?: boolean;
  OPT_IN?: boolean;
  CONTACT_TIMEZONE?: string;
  JOB_TITLE?: string;
  LINKEDIN?: string;
  [key: string]: any;
}

export interface BrevoContact {
  email: string;
  id?: number;
  attributes?: BrevoContactAttributes;
  listIds?: number[];
  emailBlacklisted?: boolean;
  smsBlacklisted?: boolean;
  createdAt?: string;
  modifiedAt?: string;
}

// Response when creating a contact
export interface BrevoCreateContactResponse {
  id: number;
}

/**
 * Creates a new contact in Brevo
 */
async function createContact(
  email: string,
  attributes: BrevoContactAttributes = {},
  listId: number = 2
): Promise<BrevoCreateContactResponse> {
  const response = await fetch(apiEndpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "api-key": BREVO_API_KEY,
    },
    body: JSON.stringify({
      email,
      attributes,
      listIds: [listId],
      updateEnabled: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Failed to create contact: ${response.status} ${response.statusText}`;
    try {
      const errorData = JSON.parse(errorText);
      if (errorData && errorData.message) {
        errorMessage = errorData.message;
      }
    } catch (parseError) {
      // If JSON parsing fails, include the parse error and use the error text as is
      if (errorText) {
        errorMessage += ` - ${errorText} (JSON parse error: ${parseError instanceof Error ? parseError.message : parseError})`;
      }
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * Updates an existing contact in Brevo by email or external ID
 */
async function updateContact(
  identifier: string,
  updates: Partial<BrevoContact> & { attributes?: BrevoContactAttributes },
  useExtId: boolean = false
): Promise<void> {
  let endpoint = apiEndpoint;

  if (useExtId && updates.attributes?.EXT_ID) {
    // If using external ID for identification
    endpoint += `ext/${identifier}`;
  } else {
    // Default to using email
    endpoint += identifier;
  }

  const response = await fetch(endpoint, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "api-key": BREVO_API_KEY,
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Failed to update contact: ${response.status} ${response.statusText}`;
    try {
      const errorData = JSON.parse(errorText);
      if (errorData && errorData.message) {
        errorMessage = errorData.message;
      }
    } catch (parseError) {
      // If JSON parsing fails, use the error text as is and include the parse error
      if (errorText) {
        errorMessage += ` - ${errorText} (JSON parse error: ${parseError instanceof Error ? parseError.message : parseError})`;
      }
    }
    throw new Error(errorMessage);
  }
}

/**
 * Gets an existing contact from Brevo by email or external ID
 */
async function getContact(
  identifier: string,
  useExtId: boolean = false
): Promise<BrevoContact> {
  let endpoint = apiEndpoint;

  if (useExtId) {
    // If using external ID for identification
    endpoint += `ext/${identifier}`;
  } else {
    // Default to using email
    endpoint += identifier;
  }

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "api-key": BREVO_API_KEY,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Failed to get contact: ${response.status} ${response.statusText}`;
    try {
      const errorData = JSON.parse(errorText);
      if (errorData && errorData.message) {
        errorMessage = errorData.message;
      }
    } catch (parseError) {
      // If JSON parsing fails, use the error text as is and include the parse error
      if (errorText) {
        errorMessage += ` - ${errorText} (JSON parse error: ${parseError instanceof Error ? parseError.message : parseError})`;
      }
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

async function addContactToList(email: string, listId: number) {
  const response = await fetch(
    apiEndpoint + "lists/" + listId + "/contacts/add",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "api-key": BREVO_API_KEY,
      },
      body: JSON.stringify({
        emails: [email],
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Failed to add contact to list: ${response.status} ${response.statusText}`;
    try {
      const errorData = JSON.parse(errorText);
      if (errorData && errorData.message) {
        errorMessage = errorData.message;
      }
    } catch (parseError) {
      // If JSON parsing fails, use the error text as is and include the parse error
      if (errorText) {
        errorMessage += ` - ${errorText} (JSON parse error: ${parseError instanceof Error ? parseError.message : parseError})`;
      }
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * Finds a Brevo contact by email or external ID (Paddle customer ID)
 * @param email The contact's email
 * @param customerId The Paddle customer ID (optional)
 * @returns The contact if found, null otherwise
 */
async function findContactByEmailOrId(email: string, customerId?: string): Promise<BrevoContact | null> {
  // First try to find by email
  try {
    const contact = await getContact(email);
    return contact;
  } catch (emailError) {
    logger.warn(emailError, `Contact not found using email: ${email}`);
    // If not found by email and we have a customer ID, try by customer ID
    if (customerId) {
      try {
        const contact = await getContact(customerId, true); // useExtId = true
        return contact;
      } catch (cidError) {
        logger.warn(cidError, `Contact not found using customerId: ${customerId}`);
        // Contact not found by either method
        return null;
      }
    }
    return null;
  }
}

/**
 * Sets a Brevo contact - updates if exists, creates if doesn't exist
 * @param email The contact's email (required)
 * @param attributes Contact attributes to set
 * @param listIds List IDs to add the contact to (optional, defaults to [2])
 * @param paddleCustomerId The Paddle customer ID (optional)
 * @returns Promise<void>
 */
async function setContact(
  email: string,
  attributes: BrevoContactAttributes = {},
  listIds: number[] = [2],
  paddleCustomerId?: string
): Promise<void> {
  try {
    // Skip if we don't have basic info
    if (!email) {
      throw new Error("Email is required to set contact");
    }

    // Add Paddle customer ID to attributes if provided
    if (paddleCustomerId) {
      attributes.EXT_ID = paddleCustomerId;
    }

    // Try to find the contact by email or customer ID
    const existingContact = await findContactByEmailOrId(email, paddleCustomerId);
    const contactFound = existingContact !== null;

    if (contactFound) {
      // Update the existing contact
      await updateContact(email, { attributes });
      logger.info(`Updated Brevo contact for ${email}`);
    } else {
      // Create a new contact with the provided info
      await createContact(email, attributes, listIds[0] || 2);
      logger.info(`Created new Brevo contact for ${email}`);
    }
  } catch (e) {
    logger.error(e, `Error setting Brevo contact for ${email}:`);
    throw e;
  }
}

/**
 * Deletes a contact from Brevo by email, ID, or external ID
 * @param identifier The email, ID, or external ID of the contact to delete
 * @param identifierType The type of identifier: 'email_id', 'contact_id', or 'ext_id'
 * @returns Whether the deletion was successful
 */
async function deleteContact(
  identifier: string | number,
  identifierType: 'email_id' | 'contact_id' | 'ext_id' = 'email_id'
): Promise<boolean> {
  try {
    let endpoint = apiEndpoint;
    
    // Handle different identifier types
    if (identifierType === 'contact_id' && typeof identifier === 'number') {
      // For contact ID, use the direct endpoint
      endpoint += identifier;
    } else if (identifierType === 'ext_id') {
      // For external ID, use the ext/ prefix
      endpoint += `ext/${identifier}`;
    } else {
      // For email or string contact ID, encode if necessary
      const encodedIdentifier = typeof identifier === 'string' 
        ? encodeURIComponent(identifier) 
        : identifier;
      endpoint += encodedIdentifier;
    }

    // Add identifierType query parameter if not using default email_id
    const url = identifierType !== 'email_id' 
      ? `${endpoint}?identifierType=${identifierType}`
      : endpoint;

    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        "api-key": BREVO_API_KEY,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Failed to delete contact: ${response.status} ${response.statusText}`;
      try {
        const errorData = JSON.parse(errorText);
        if (errorData && errorData.message) {
          errorMessage = errorData.message;
        }
      } catch (jsonParseError) {
        // If JSON parsing fails, use the error text as is
        if (errorText) {
          errorMessage += ` - ${errorText}`;
        }
        // Optionally log the JSON parsing error for debugging
        logger.error(`JSON parsing error while deleting contact: ${jsonParseError}`);
      }
      logger.error(errorMessage);
      return false;
    }

    logger.info(`Successfully deleted Brevo contact: ${identifier}`);
    return true;
  } catch (error) {
    logger.error(`Error deleting Brevo contact ${identifier}: ${error}`);
    return false;
  }
}

export const BrevoClient = {
  addContactToList,
  createContact,
  updateContact,
  setContact,
  findContactByEmailOrId,
  getContact,
  deleteContact,
};
