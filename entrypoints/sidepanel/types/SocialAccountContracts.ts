/** Public, credential-free contract matching Background R3.2. */
export const SOCIAL_ACCOUNT_PLATFORMS = ["facebook", "tiktok", "x", "threads"] as const;
export type SocialAccountPlatform = (typeof SOCIAL_ACCOUNT_PLATFORMS)[number];

export type AccountSource = { userId: string; sessionId: string } & (
  | { type: "extension_config"; extensionConfigId: string }
  | { type: "persona"; personaId: string }
);

export type SocialAccountSummary = {
  accountId: string;
  platform: SocialAccountPlatform;
  name?: string;
  status: string;
  hasCookies: boolean;
  hasProxy: boolean;
};

type CatalogIdentity = { source: AccountSource; accounts: SocialAccountSummary[] };
export type SocialAccountState = CatalogIdentity & (
  | { status: "uninitialized"; revision: 0; refreshedAt: null }
  | { status: "cached"; revision: number; refreshedAt: number }
);
export type RefreshedSocialAccountState = Extract<SocialAccountState, { status: "cached" }>;

export type SocialAccountRequest =
  | { type: "SOCIAL_ACCOUNT_GET_STATE"; inputs?: { platform: SocialAccountPlatform } }
  | { type: "SOCIAL_ACCOUNT_REFRESH" };

export type SocialAccountErrorCode =
  | "AUTH_REQUIRED"
  | "PERSONA_REQUIRED"
  | "ACCOUNT_SOURCE_CHANGED"
  | "ACCOUNT_LOAD_FAILED"
  | "UNSUPPORTED_PLATFORM"
  | "INVALID_RESPONSE"
  | "REQUEST_TIMEOUT"
  | "TRANSPORT_FAILED"
  | "UNKNOWN_ERROR";
