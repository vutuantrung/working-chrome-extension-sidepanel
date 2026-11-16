import type { ExtensionRuntimePort } from "../../types/BrowserPorts";
import type { User } from "../../types/types";

export type AuthState = { user: User | null; isApikeySession: boolean };
export type AuthLoginResult = {
  user: User;
  isApikeySession: boolean;
  extensionConfig: any;
  configurationUnavailable: boolean;
};

export type AutoLoginResult =
  | { status: "anonymous" }
  | { status: "restored"; user: User; isApikeySession: boolean }
  | { status: "authenticated"; session: AuthLoginResult };

export type SessionEndResult = {
  cleared: true;
  snapshotPreserved: boolean;
  signoutConfirmed: boolean | null;
};

export type RecoveryResult =
  | { status: "recovered"; session: AuthLoginResult }
  | { status: "signed_out"; snapshotPreserved: boolean };

type AuthResponse<T> = { success: true; data: T } | { success: false; error?: string; code?: string };

export class AuthClient {
  constructor(private readonly runtime: ExtensionRuntimePort, private readonly timeoutMs = 125_000) { }

  private async request<T>(type: string, inputs?: Record<string, unknown>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Authentication request timed out")), this.timeoutMs);
      });
      const response = await Promise.race([
        this.runtime.sendMessage<AuthResponse<T>>({ type, ...(inputs ? { inputs } : {}) }),
        timeout,
      ]);
      if (!response || response.success !== true || response.data == null) {
        throw new Error(response?.success === false
          ? response.error || "Authentication failed"
          : "Invalid authentication response");
      }
      return response.data;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  login(username: string, password: string, extensionId: string): Promise<AuthLoginResult> {
    return this.request("AUTH_LOGIN", { username, password, extensionId });
  }

  loginByApiKey(apiKey: string, extensionId: string): Promise<AuthLoginResult> {
    return this.request("AUTH_LOGIN_BY_API_KEY", { apiKey, extensionId });
  }

  autoLogin(extensionId: string): Promise<AutoLoginResult> {
    return this.request("AUTH_AUTO_LOGIN", { extensionId });
  }

  private async endSession(type: "AUTH_LOGOUT" | "AUTH_RESTART", extensionId: string): Promise<SessionEndResult> {
    const result = await this.request<SessionEndResult>(type, { extensionId });
    if (result.cleared !== true) throw new Error("Background did not acknowledge session cleanup");
    return result;
  }

  logout(extensionId: string): Promise<SessionEndResult> {
    return this.endSession("AUTH_LOGOUT", extensionId);
  }

  restart(extensionId: string): Promise<SessionEndResult> {
    return this.endSession("AUTH_RESTART", extensionId);
  }

  async recoverSession(extensionId: string, allowLegacyCredentials = false): Promise<RecoveryResult> {
    const result = await this.request<RecoveryResult>("AUTH_RECOVER_SESSION", { extensionId, allowLegacyCredentials });
    if (result.status === "signed_out" && typeof result.snapshotPreserved === "boolean") return result;
    if (result.status === "recovered" && result.session?.user?.id) return result;
    throw new Error("Invalid session recovery response");
  }

  getState(): Promise<AuthState> {
    return this.request("AUTH_GET_STATE");
  }
}
