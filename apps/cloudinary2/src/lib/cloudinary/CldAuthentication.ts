import { jwtDecode } from 'jwt-decode';
import { CLOUDINARY_API_GATEWAY_BASE_URL } from '../../constants';

export interface LoginPersistenceProvider {
  save(token: string): Promise<void>;
  get(): Promise<string>;
  delete(): Promise<void>;
}

export interface LoginOptions {
  authBaseUrl?: string;
  persistenceProvider?: LoginPersistenceProvider;
}

/**
 * Memory-based persistence provider (default)
 * Stores token in memory - token are lost when the application closes
 */
export class MemoryPersistenceProvider implements LoginPersistenceProvider {
  private token: string | null = null;

  async save(token: string): Promise<void> {
    this.token = token;
  }

  async get(): Promise<string> {
    if (!this.token) {
      throw new Error('No token found in memory');
    }
    return this.token;
  }

  async delete(): Promise<void> {
    this.token = null;
  }
}

/**
 * LocalStorage-based persistence provider
 * Stores token in browser's localStorage - token persist across sessions
 */
export class LocalStoragePersistenceProvider implements LoginPersistenceProvider {
  private storageKey: string;

  constructor(storageKey: string = '@cld-et/auth-token') {
    this.storageKey = storageKey;
  }

  async save(token: string): Promise<void> {
    try {
      localStorage.setItem(this.storageKey, token);
    } catch (error) {
      // Handle quota exceeded or localStorage disabled
      console.warn('Failed to save token to localStorage:', error);
      throw new Error('Failed to persist token to localStorage');
    }
  }

  async get(): Promise<string> {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) {
        throw new Error(`No token found in localStorage [${this.storageKey}]`);
      }
      return stored;
    } catch (error) {
      if (error instanceof Error && error.message.includes('No token found')) {
        throw error;
      }
      console.warn('Failed to retrieve token from localStorage:', error);
      throw new Error('Failed to retrieve token from localStorage');
    }
  }

  async delete(): Promise<void> {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.warn('Failed to delete token from localStorage:', error);
    }
  }
}

export class CloudinaryAuthenticationService {
  private authBaseUrl: string;
  private persistenceProvider: LoginPersistenceProvider;
  private popupCheckInterval: number | null = null;
  private messageListener: ((event: MessageEvent) => void) | null = null;

  constructor(options?: LoginOptions) {
    this.authBaseUrl = options?.authBaseUrl || CLOUDINARY_API_GATEWAY_BASE_URL;
    this.persistenceProvider = options?.persistenceProvider || new MemoryPersistenceProvider();
  }

  /**
   * Opens OAuth flow in a popup window and returns token
   * @param returnToUrl - The URL to redirect back to after authentication
   * @returns Promise that resolves with oauth and console token
   * @throws Error if popup is blocked, closed by user, or auth fails
   */

  async login(returnToUrl?: 'render://postMessage' | string): Promise<string> {
    if (!returnToUrl) {
      returnToUrl = 'render://postMessage';
    }
    return new Promise((resolve, reject) => {
      // Construct the auth URL with required parameters
      const authUrl = `${this.authBaseUrl}/auth/login/cloudinary?return_to=${encodeURIComponent(returnToUrl)}&token_type=console`;
      // Calculate centered position for popup
      const width = 600;
      const height = 800;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      const windowFeatures = `width=${width},height=${height},left=${left},top=${top},screenY=${top},screenX=${left},scrollbars=yes,resizable=yes`;

      // Open popup window
      const popup = window.open(authUrl, 'CloudinaryOAuth', windowFeatures);

      // Check if popup was blocked
      if (!popup) {
        this.persistenceProvider.delete().catch(() => {
          // Ignore deletion errors
        });
        reject(new Error('Popup was blocked. Please allow popups for this site.'));
        return;
      }
      popup.focus();

      // Set timeout for auth flow (5 minutes)
      const timeout = setTimeout(() => {
        this.cleanup(popup);
        this.persistenceProvider.delete().catch(() => {
          // Ignore deletion errors
        });
        reject(new Error('Authentication timeout. Please try again.'));
      }, 5 * 60 * 1000);

      // Poll to detect if user closes the popup
      this.popupCheckInterval = window.setInterval(() => {
        if (popup.closed) {
          this.cleanup(null);
          clearTimeout(timeout);
          this.persistenceProvider.delete().catch(() => {
            // Ignore deletion errors
          });
          reject(new Error('Authentication was cancelled by the user.'));
        }
      }, 500);

      // Listen for message from the callback page
      this.messageListener = (event: MessageEvent) => {
        // Validate message origin for security
        const allowedOrigins = [this.authBaseUrl, window.location.origin, new URL(returnToUrl).origin];

        if (!allowedOrigins.includes(event.origin)) {
          return;
        }
        // Check if this is our auth callback message
        if (event.data && event.data.type === 'CLOUDINARY_AUTH_CALLBACK') {
          const { type, ...payload } = event.data;

          clearTimeout(timeout);
          this.cleanup(popup);

          if (payload.error) {
            this.persistenceProvider.delete().catch(() => {
              // Ignore deletion errors
            });
            reject(new Error(`Authentication failed: ${payload.error}`));
          } else {
            const token = payload.accessToken;
            // Save token to persistence, but don't block on it
            this.persistenceProvider.save(token).catch((error) => {
              console.warn('Failed to persist token:', error);
              // Still resolve with token even if persistence fails
            });
            resolve(token);
          }
        }
      };

      window.addEventListener('message', this.messageListener);
    });
  }

  /**
   * Clean up event listeners and intervals
   * @param popup - The popup window to close (if still open)
   */
  private cleanup(popup: Window | null) {
    // Clear interval
    if (this.popupCheckInterval !== null) {
      clearInterval(this.popupCheckInterval);
      this.popupCheckInterval = null;
    }

    // Remove message listener
    if (this.messageListener) {
      window.removeEventListener('message', this.messageListener);
      this.messageListener = null;
    }

    // Close popup if still open
    if (popup && !popup.closed) {
      popup.close();
    }
  }

  /**
   * Logout and clear stored token
   * @returns Promise that resolves when token are deleted
   */
  async logout(): Promise<void> {
    await this.persistenceProvider.delete();
  }

  /**
   * Retrieve stored authentication token
   * @returns Promise that resolves with stored token
   * @throws Error if no token are stored
   */
  async getStoredToken(): Promise<string | null> {
    try {
      return await this.persistenceProvider.get();
    } catch (error) {
      return null;
    }
  }

  async getCloudName(): Promise<string | null> {
    const token = await this.getStoredToken();
    if (!token) {
      return null;
    }
    // parse token
    const decodedToken = jwtDecode<JwtPayload>(token);
    return decodedToken.cloudName;
  }
}

interface JwtPayload {
  sessionId: string;
  service: string;
  cloudName: string;
  iat?: number;
  exp?: number;
}
export const cldAuthenticationService = new CloudinaryAuthenticationService({
  authBaseUrl: CLOUDINARY_API_GATEWAY_BASE_URL,
  persistenceProvider: new LocalStoragePersistenceProvider(),
});
