import type { ExtensionRuntimePort } from "../../types/BrowserPorts";
import {
  SOCIAL_ACCOUNT_PLATFORMS,
  type AccountSource,
  type SocialAccountPlatform,
  type SocialAccountSummary,
  type SocialAccountState,
  type RefreshedSocialAccountState,
  type SocialAccountRequest,
  type SocialAccountErrorCode,
} from "../../types/SocialAccountContracts";

const REMOTE_ERRORS: Record<string, string> = {
  AUTH_REQUIRED: "Authentication required",
  PERSONA_REQUIRED: "An acknowledged active persona is required",
  ACCOUNT_SOURCE_CHANGED: "Account source changed",
  ACCOUNT_LOAD_FAILED: "Account operation failed",
  UNSUPPORTED_PLATFORM: "Unsupported account platform",
};

export class SocialAccountClientError extends Error {
  constructor(readonly code: SocialAccountErrorCode, message: string) {
    super(message);
    this.name = "SocialAccountClientError";
  }
}

function invalidResponse(): never {
  throw new SocialAccountClientError("INVALID_RESPONSE", "Invalid social account response");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
function isPlatform(value: unknown): value is SocialAccountPlatform {
  return SOCIAL_ACCOUNT_PLATFORMS.some(platform => platform === value);
}
function parseSource(value: unknown): AccountSource {
  if (!isRecord(value) || !nonEmpty(value.userId) || typeof value.sessionId !== "string") return invalidResponse();
  const identity = { userId: value.userId, sessionId: value.sessionId };
  if (value.type === "persona" && nonEmpty(value.personaId)) {
    return { ...identity, type: "persona", personaId: value.personaId };
  }
  if (value.type === "extension_config" && nonEmpty(value.extensionConfigId)) {
    return { ...identity, type: "extension_config", extensionConfigId: value.extensionConfigId };
  }
  return invalidResponse();
}

function parseSummary(value: unknown, platform?: SocialAccountPlatform): SocialAccountSummary {
  if (!isRecord(value) || !nonEmpty(value.accountId) || !isPlatform(value.platform) ||
      (platform !== undefined && value.platform !== platform) || !nonEmpty(value.status) ||
      (value.name !== undefined && typeof value.name !== "string") ||
      typeof value.hasCookies !== "boolean" || typeof value.hasProxy !== "boolean") return invalidResponse();
  // Never pass through additional fields (including raw credentials).
  return {
    accountId: value.accountId, platform: value.platform, status: value.status,
    ...(typeof value.name === "string" ? { name: value.name } : {}),
    hasCookies: value.hasCookies, hasProxy: value.hasProxy,
  };
}

function parseState(value: unknown, platform?: SocialAccountPlatform): SocialAccountState {
  if (!isRecord(value) || !Array.isArray(value.accounts)) return invalidResponse();
  const source = parseSource(value.source);
  const accounts = value.accounts.map(account => parseSummary(account, platform));
  if (new Set(accounts.map(account => JSON.stringify([account.platform, account.accountId]))).size !== accounts.length) return invalidResponse();
  if (value.status === "uninitialized" && value.revision === 0 &&
      value.refreshedAt === null && accounts.length === 0) {
    return { source, accounts: [], revision: 0, refreshedAt: null, status: "uninitialized" };
  }
  if (value.status === "cached" && typeof value.revision === "number" &&
      Number.isSafeInteger(value.revision) && value.revision > 0 &&
      typeof value.refreshedAt === "number" && Number.isFinite(value.refreshedAt) && value.refreshedAt >= 0) {
    return { source, accounts, revision: value.revision, refreshedAt: value.refreshedAt, status: "cached" };
  }
  return invalidResponse();
}

function parseResponse(value: unknown, platform?: SocialAccountPlatform): SocialAccountState {
  if (!isRecord(value)) return invalidResponse();
  if (value.success === false) {
    // Do not surface arbitrary upstream text/credentials in UI errors.
    const code = typeof value.code === "string" && Object.prototype.hasOwnProperty.call(REMOTE_ERRORS, value.code)
      ? value.code as SocialAccountErrorCode : "UNKNOWN_ERROR";
    throw new SocialAccountClientError(code, REMOTE_ERRORS[code] ?? "Unknown social account error");
  }
  if (value.success !== true) return invalidResponse();
  return parseState(value.data, platform);
}

/** Runtime-only client: no HTTP, storage or business policy dependencies. */
export class SocialAccountClient {
  constructor(
    private readonly runtime: ExtensionRuntimePort,
    private readonly timeoutMs = 125_000,
  ) {}

  private async request(message: SocialAccountRequest): Promise<SocialAccountState> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let response: unknown;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new SocialAccountClientError("REQUEST_TIMEOUT",
          "Social account request timed out; background operation may still complete")), this.timeoutMs);
      });
      response = await Promise.race([this.runtime.sendMessage<unknown>(message), timeout]);
    } catch (error) {
      if (error instanceof SocialAccountClientError) throw error;
      throw new SocialAccountClientError("TRANSPORT_FAILED", "Unable to communicate with Background");
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
    return parseResponse(response, message.type === "SOCIAL_ACCOUNT_GET_STATE" ? message.inputs?.platform : undefined);
  }

  async getState(platform?: SocialAccountPlatform): Promise<SocialAccountState> {
    if (platform !== undefined && !isPlatform(platform)) {
      throw new SocialAccountClientError("UNSUPPORTED_PLATFORM", "Unsupported account platform");
    }
    return this.request({ type: "SOCIAL_ACCOUNT_GET_STATE", ...(platform !== undefined ? { inputs: { platform } } : {}) });
  }

  async refresh(): Promise<RefreshedSocialAccountState> {
    const state = await this.request({ type: "SOCIAL_ACCOUNT_REFRESH" });
    if (state.status !== "cached") return invalidResponse();
    return state;
  }
}
