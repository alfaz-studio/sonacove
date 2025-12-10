import { useState, useEffect, useCallback } from 'react';
import { getAuthService } from '../utils/AuthService';
import { format } from 'date-fns';
import type { DbUser } from '../pages/meet/types';
import type { User as OidcUser } from 'oidc-client-ts';
import { fetchDbUser } from '../utils/api';
import { getOrganizationFromJWT } from '../lib/modules/jwt';

/**
 * A simplified representation of a booked meeting for UI display.
 */
export interface Meeting {
  /** The name of the meeting room. */
  title: string;
  /** The formatted end date of the meeting. */
  date: string;
  /** The formatted time the meeting was created. */
  time: string;
  /** The status of the meeting, e.g., 'Upcoming' or 'Expired'. */
  status: string;
}

const authService = getAuthService();

/**
 * A comprehensive custom hook to manage the entire user authentication lifecycle and session data.
 * It handles OIDC authentication state, fetches custom user data from the database,
 * and provides derived state like a formatted list of meetings.
 *
 * @returns {object} An object containing auth state, user data, and action methods.
 * @property {boolean} isLoggedIn - True if the user is currently authenticated with the OIDC provider.
 * @property {DbUser | null} dbUser - The user's full profile from the custom application database, including booked rooms.
 * @property {OidcUser | null} user - The raw user object from the OIDC provider.
 * @property {Meeting[]} meetings - A formatted list of the user's booked meetings.
 * @property {() => Promise<void>} refetchMeetings - A function to manually re-fetch the user's data from the database.
 * @property {() => void | undefined} login - A function to initiate the OIDC login flow.
 * @property {() => void | undefined} logout - A function to initiate the OIDC logout flow.
 * @property {() => string | null} getAccessToken - A function to retrieve the user's current JWT access token.
 */
export function useAuth() {
  /** State to hold the OIDC authentication status. */
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => authService?.isLoggedIn() ?? false,
  );

  const [oidcUser, setOidcUser] = useState<OidcUser | null>(
    () => authService?.getUser() ?? null,
  );
  /** State for the user profile fetched from the application's database. */
  const [dbUser, setDbUser] = useState<DbUser | null>(null);
  /** State for the formatted list of meetings derived from the dbUser. */
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  /** Organization context derived from the Keycloak token (organization scope). */
  const [orgContext, setOrgContext] = useState<{
    orgAlias: string | null;
    orgId?: string | null;
  }>({ orgAlias: null, orgId: null });

  // Effect to subscribe to the global AuthService and keep local state in sync.
  useEffect(() => {
    if (!authService) return;
    const unsubscribe = authService.subscribe((state) => {
      setIsLoggedIn(state.isLoggedIn);
      setOidcUser(state.user);
    });
    return unsubscribe;
  }, []);

  /**
   * Manually triggers a re-fetch of the user's data from the database.
   * Useful after performing an action like booking a meeting.
   */
  const refetchMeetings = useCallback(async () => {
    const token = authService?.getAccessToken();
    if (!token) {
      console.error('Refetch failed: No user is logged in.');
      return;
    }

    try {
      const data = await fetchDbUser(token);
      setDbUser(data);
    } catch (error) {
      console.error('Failed to refetch user from DB:', error);
      setDbUser(null);
    }
  }, []);

  useEffect(() => {
    const getUserData = async (token: string) => {
      try {
        const data = await fetchDbUser(token);
        setDbUser(data);
      } catch (error) {
        console.error('Failed to fetch user from DB:', error);
        setDbUser(null);
      }
    };

    if (isLoggedIn && oidcUser?.access_token) {
      getUserData(oidcUser.access_token);

      const org = getOrganizationFromJWT(oidcUser.access_token);
      setOrgContext({
        orgAlias: org?.orgAlias ?? null,
        orgId: org?.orgId ?? null,
      });
    } else {
      setDbUser(null);
      setOrgContext({ orgAlias: null, orgId: null });
    }
  }, [oidcUser?.profile.sub, oidcUser?.access_token, isLoggedIn]);

  useEffect(() => {
    if (dbUser && dbUser.bookedRooms) {
      const currentDate = new Date();

      const transformedMeetings = dbUser.bookedRooms.map((room) => {
        const endDate = new Date(room.endDate);
        const createdAt = new Date(room.createdAt);

        return {
          title: room.roomName,
          date: format(endDate, 'MMMM dd, yyyy'),
          time: format(createdAt, 'p'),
          status: endDate > currentDate ? 'Upcoming' : 'Expired',
        };
      });

      setMeetings(transformedMeetings);
    } else {
      setMeetings([]);
    }
  }, [dbUser]);

  return {
    isLoggedIn,
    dbUser,
    user: oidcUser,
    org: orgContext,
    meetings,
    refetchMeetings,
    login: () => authService?.login(),
    logout: () => authService?.logout(),
    getAccessToken: () => authService?.getAccessToken() ?? null,
  };
}
