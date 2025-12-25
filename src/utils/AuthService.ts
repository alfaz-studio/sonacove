import {
  User,
  UserManager,
  WebStorageStateStore,
  InMemoryWebStorage,
  type UserManagerSettings,
} from 'oidc-client-ts';
import { PUBLIC_CF_ENV } from 'astro:env/client';

let userManager: UserManager | null = null;

/**
 * A singleton getter for the UserManager.
 * This function ensures that UserManager and its settings are only created on the client-side.
 */
export function getUserManager(): UserManager {
  if (userManager) {
    return userManager;
  }

  const isServer = typeof window === 'undefined';

  const siteUrl = isServer
    ? import.meta.env.PUBLIC_SITE_URL || 'http://localhost:4321'
    : window.location.origin;

  const userStore = isServer
    ? new WebStorageStateStore({ store: new InMemoryWebStorage() })
    : new WebStorageStateStore({ store: window.localStorage });

  const authorityUrl =
    PUBLIC_CF_ENV === 'production'
      ? 'https://auth.sonacove.com/auth/realms/jitsi'
      : 'https://staj.sonacove.com/auth/realms/jitsi';

  const settings: UserManagerSettings = {
    authority: authorityUrl,
    client_id: 'jitsi-web',
    redirect_uri: `${siteUrl}/login-callback`,
    post_logout_redirect_uri: `${siteUrl}/logout-callback`, 
    silent_redirect_uri: `${siteUrl}/silent-renew`,
    response_type: 'code',
    scope: 'openid profile email offline_access organization',
    automaticSilentRenew: true,
    userStore: userStore,
  };

  // Create the instance.
  userManager = new UserManager(settings);

  return userManager;
}


type AuthState = {
  user: User | null;
  isLoggedIn: boolean;
};

type AuthStateListener = (state: AuthState) => void;

class AuthService {
  private userManager = getUserManager();
  private state: AuthState = { user: null, isLoggedIn: false };
  private listeners: Set<AuthStateListener> = new Set();

  constructor() {
    this.initialize();
  }

  /**
   * Initializes the service, loads the user, and sets up event listeners.
   */
  private async initialize(): Promise<void> {
    let user = await this.userManager.getUser();

    // If the user is in storage but expired, try to renew the token silently
    if (user && user.expired) {
      try {
        // signinSilent will use the refresh_token to get a new access_token
        user = await this.userManager.signinSilent();
      } catch (error) {
        console.error(
          'AuthService: Silent renew failed, user is logged out.',
          error,
        );
        // If silent renew fails, the user is logged out.
        user = null;
      }
    }

    this.updateState(user);

    this.userManager.events.addUserLoaded((user) => this.updateState(user));
    this.userManager.events.addUserUnloaded(() => this.updateState(null));
    this.userManager.events.addSilentRenewError((error) => {
      console.error('AuthService: Silent renew error', error);
      this.updateState(null);
    });
  }

  /**
   * A private helper to update the internal state and notify subscribers.
   */
  private updateState(user: User | null): void {
    this.state = {
      user: user,
      isLoggedIn: !!user && !user.expired,
    };
    // Notify all listeners of the state change
    this.listeners.forEach((listener) => listener(this.state));
  }

  /**
   * Subscribes to authentication state changes.
   * @param listener The callback function to execute on change.
   * @returns An unsubscribe function.
   */
  public subscribe(listener: AuthStateListener): () => void {
    this.listeners.add(listener);
    // Immediately notify the new listener with the current state
    listener(this.state);
    // Return a function to allow unsubscribing
    return () => this.listeners.delete(listener);
  }

  // --- Browser-Only Methods with Safety Checks ---
  private ensureBrowser(): void {
    if (typeof window === 'undefined') {
      throw new Error(
        'This authentication method can only be called in a browser environment.',
      );
    }
  }

  /**
   * Kicks off the login process by redirecting to the login page.
   */
  public login(): Promise<void> {
    this.ensureBrowser();

    // If in Electron, do NOT start OIDC here (state will be trapped in Electron).
    // Instead, open the browser to the dashboard login page so it generates the state there.
    // @ts-ignore
    if (window.jitsiNodeAPI) {
        // We append ?source=desktop so the browser knows to redirect back to the app later
        const targetUrl = `${window.location.origin}/login-desktop-proxy`; 
        
        // Use the bridge to open external URL
        // @ts-ignore
        window.jitsiNodeAPI.ipc.send('open-external', targetUrl);
        return Promise.resolve();
    }

    return this.userManager.signinRedirect({
      state: window.location.pathname + window.location.search,
    });
  }

  /**
   * Redirects the user to the Keycloak registration page.
   */
  public signup(): Promise<void> {
    this.ensureBrowser();
    return this.userManager.signinRedirect({
      state: window.location.pathname + window.location.search,
      extraQueryParams: {
        prompt: 'create',
        kc_action: 'register',
      },
    });
  }

  /**
   * Handles the authentication callback after the user is redirected back from the login page.
   * @returns The user object.
   */
  public handleLoginCallback(): Promise<User | null> {
    this.ensureBrowser();
    return this.userManager.signinRedirectCallback();
  }

  /**
   * Kicks off the logout process.
   */
  public logout(): Promise<void> {
    this.ensureBrowser();
    sessionStorage.setItem('logout_return_url', window.location.href);
    return this.userManager.signoutRedirect();
  }

  /**
   * Handles logout callback after the user is redirected back from the logout page.
   */
  public handleLogoutCallback(): Promise<any> {
    this.ensureBrowser();
    return this.userManager.signoutRedirectCallback();
  }


  /**
   * Gets the current user object.
   */
  public getUser(): User | null {
    return this.state.user;
  }

  /**
   * Gets the user's access token for API calls.
   * @returns The access token or null if not logged in.
   */
  public getAccessToken(): string | null {
    return this.state.user?.access_token ?? null;
  }

  /**
   * A simple boolean to check if the user is currently logged in.
   */
  public isLoggedIn(): boolean {
    return this.state.isLoggedIn;
  }
}

// --- Isomorphic Singleton Getter ---
let authServiceInstance: AuthService | null = null;

export function getAuthService(): AuthService {
  if (!authServiceInstance) {
    authServiceInstance = new AuthService();
  }

  return authServiceInstance;
}
