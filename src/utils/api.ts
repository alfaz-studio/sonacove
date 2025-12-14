import type { DbUser } from '../pages/meet/types';

const API_BASE_URL = 'api';

async function handleApiResponse(response: Response) {
  if (!response.ok) {
    let errorMessage = `API Error: ${response.status}`;
    try {
      const errorData: unknown = await response.json();
      if (
        typeof errorData === 'object' &&
        errorData !== null &&
        'error' in errorData &&
        typeof (errorData as { error: unknown }).error === 'string'
      ) {
        errorMessage += ` - ${(errorData as { error: string }).error}`;
      }
    } catch {}
    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return { success: true };
  }

  return response.json();
}

/**
 * Fetches the database user information for the authenticated user.
 * @param {string} token The user's JWT access token.
 * @returns The user data from the database.
 */
export const fetchDbUser = async (token: string): Promise<DbUser> => {
  const response = await fetch(`${API_BASE_URL}/db-user`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return handleApiResponse(response) as Promise<DbUser>;
};

/**
 * Books a new meeting.
 * @param {string} roomName  The name of the room to book.
 * @param {string} endDate The end date of the booking (or null for permanent).
 * @param {string} token The user's JWT access token.
 * @returns The result from the API.
 */
export const bookMeeting = async (
  roomName: string,
  endDate: Date | null,
  token: string,
) => {
  if (!roomName.trim()) {
    throw new Error('Room name is required.');
  }

  const response = await fetch(`${API_BASE_URL}/manage-booking`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      roomName,
      password: '',
      lobby: false,
      maxOccupants: 100,
      endDate: endDate ? endDate.toISOString() : null, // Ensure date is in ISO format
    }),
  });
  return handleApiResponse(response);
};

/**
 * Deletes a booked meeting.
 * @param {string} roomName The name of the room to delete.
 * @param {string} token The user's JWT access token.
 * @returns A success indicator from the API.
 */
export const deleteBooking = async (roomName: string, token: string) => {
  if (!roomName.trim()) {
    throw new Error('A valid room name is required.');
  }

  const response = await fetch(`${API_BASE_URL}/manage-booking`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      roomName: roomName.trim(),
    }),
  });
  return handleApiResponse(response);
};

/**
 * Checks if a room name is available or already booked.
 * @param {string} roomName The name of the room to check.
 * @param {string} token The user's JWT access token.
 * @returns An object indicating if the room is available.
 */
export const checkRoomAvailability = async (
  roomName: string,
  token: string,
): Promise<{ available: boolean; roomName: string }> => {
  if (!roomName.trim()) {
    throw new Error('A room name is required for the availability check.');
  }

  // Safely encode the room name to be used as a URL parameter
  const encodedRoomName = encodeURIComponent(roomName.trim());

  const response = await fetch(
    `${API_BASE_URL}/room-availability?roomName=${encodedRoomName}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  return handleApiResponse(response) as Promise<{
    available: boolean;
    roomName: string;
  }>;
};

/**
 * Fetches meetings for the authenticated user within a date range.
 * @param {string} token The user's JWT access token.
 * @param {Date} from The start date of the range.
 * @param {Date} to The end date of the range.
 * @returns Array of meeting metadata.
 */
export const fetchMeetings = async (
  token: string,
  from?: Date,
  to?: Date,
): Promise<any[]> => {
  const params = new URLSearchParams();
  if (from) {
    params.append('from', from.toISOString());
  }
  if (to) {
    params.append('to', to.toISOString());
  }

  const queryString = params.toString();
  const url = `${API_BASE_URL}/meeting-history${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return handleApiResponse(response) as Promise<any[]>;
};
