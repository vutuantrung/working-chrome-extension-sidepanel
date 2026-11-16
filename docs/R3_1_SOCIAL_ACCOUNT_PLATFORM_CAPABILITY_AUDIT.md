# R3.1 — Social Account & Platform Capability Audit

Status: static audit / proposed contracts. No production changes. Baselines:
- Background main: d82aa1f8d46b23a62bb38c64ece8f0abc16d4bfd
- Sidepanel main: 669a7ca20d54ceabb44a4effa4a2c285d9e670cd
R2.5 review only; R1/R2 integrated verification remains open. Targeted audit, not exhaustive search of all consumers. No build, test or server execution.

## Scope and boundaries
R3 owns assigned account source identity, normalized account catalog, platform-specific mode and account selection, login preparation/orchestration and coordination after persona switch. R4 owns physical proxy/cookie application, cookie snapshot security/domain isolation and proxy precedence. Auth owns application identity and session; Persona owns selected/activated identity. Use existing runTimeOnMessageHandlerInternal, ApplicationServices and browser adapters. Do not introduce raw Chrome API or unrelated infrastructure rewrite.

## Capability inventory
| Capability | Current owner | Target |
|---|---|---|
| Resolve config/persona source | AuthContext, ChoosePlatform, SyncService | R3.2 |
| Normalize/filter/dedupe | both proxy helper implementations, page/sync inline logic | R3.2 |
| Refresh assigned accounts | ChoosePlatform.refreshPersonaAccounts, AuthContext.reapplyPlatformLoginAfterPersonaSwitch, SyncService.handleSyncExtensionInfo | R3.2 |
| Embedded account projection | AuthContext.persistPersonaSocialAccounts / applyAuthenticatedSession | R3.2 |
| Resolve cached accounts | getPersonaFacebookAccounts, getFacebookAccountsForSession | R3.2 |
| Account proxy enrichment | hydrateAccountsWithProxy, ChoosePlatform, SyncService | R3.2 temporary compatibility, R4 final ownership |
| Platform state | ChoosePlatform, PlatformPage, AuthContext.readPlatformLoginMode | R3.3 |
| Auto/manual setup | AuthContext.loginWithMode | R3.4 |
| Reopen platform after relogin | resumeSocialPlatformAfterRelogin / applyConfigProxyAndManualCookieSnapshot | R3.4/R4 |
| Reapply after persona switch | reapplyPlatformLoginAfterPersonaSwitch, switchPersona | R3.5 |
| Physical browser resources | applyEffectiveProxy, applyCookieList, clearPlatformBrowserCookies, manual cookie snapshot | R4 |
| UI selection/navigation | ChoosePlatform (FacebookLoginMode), PlatformPage (SwitchPlatform), PlatformSelect, AppRoutes, PlatformMetaBar | Sidepanel |

## Observed flows
1. Config login: AuthContext.applyAuthenticatedSession normalizes extensionConfig.social_accounts, stores allSocialAccounts/facebookAccounts; ensures default persona; passes raw config, proxy, all_social_accounts into INITIALIZE_AFTER_LOGIN. Persona restore also runs, but config should remain the effective account source. RestoreExistingSession reads cached Facebook accounts, restores persona resources, resolves proxy and initializes Background. Background auth recovery UI reconciliation currently does not fully reinitialize resources.
2. Persona onboarding: ChoosePlatform.refreshPersonaAccounts checks config ID truthiness and reads document-local selectedPersonaId; GET accounts, filter active, normalize twitter->x, fetch missing proxy, normalize again, persist four projection keys. Empty list early return, zero Facebook subset not written, errors fallback to previously cached accounts.
3. ChoosePlatform.handleSelectPlatform writes selectedPlatform before setup. Reads platform-specific mode key and fbLoginModeSelected, then refreshes and auto-resumes saved mode if truthy. Failure clears mode keys and onboarding flag. Error branch incorrectly reads storage result.reason rather than loginResult.reason. ChoosePlatform.handleLoginMode writes string and structured mode before setup, refreshes on auto, calls loginWithMode, marks ready/navigates on success. Some errors/throw paths can leave busy flags set; do not infer success from flags.
4. PlatformPage.handleLoginMode duplicates writes but does not perform refresh. It also sets selectedPlatform before successful setup. Failure removes keys but does not necessarily clear onboarding flag. UI and route state can differ.
5. AuthContext.loginWithMode writes {mode,platform} before validation; auto chooses first available account (account_id initially unset), resolves proxy, checks cookie presence, persists account_id, applies cookies, opens tab. No explicit clearing of old cookies in this initial auto path. Manual restores effective proxy/manual snapshot and opens tab. success indicates local operations, not remote login verification. Unknown platform falls back to Facebook URL. Exceptions can escape LoginResult contract.
6. Persona switch: R2.4 Background commits target active with resourceSetupPending after remote switch and cache invalidation. UI loads details and applies resource setup; reapplyPlatformLoginAfterPersonaSwitch reads document selected platform/flag, reads mode, prefers stored hydrated accounts, may fetch target accounts, resolves proxy and chooses previous account or first available, clears/apply platform cookies for auto, clears platform cookies/manual snapshot in manual mode. Completion is UI-reported; no independent proof. Shared auth queue does not cover transitional setup, alarms or legacy writers.
7. SyncService.handleSyncExtensionInfo has another account refresh path for persona auto mode; uses legacy cache, raw normalized accounts, proxy enrichment, writes allSocialAccounts/personaFacebookAccounts only when nonempty. Config branch fetches extension config and derives proxy from social_accounts. Existing INITIALIZE_AFTER_LOGIN reads cached state and may write account projections from message. Both may interfere with new catalog ownership. SyncService imports missing ../infrastructure/api/user.api and getExtensionConfigInfo from source-member.api (not exported at baseline). Static compile blockers; not repaired here. Existing StorageService cache miss recursion and deep merge are pending infrastructure risks; use durable reads and replacement patch for new operations.

## API inventory
- GET /extension-configs/:id through extension-user.api.getExtensionConfigInfo(http,id,filter), includes relation proxy/user/social_accounts and topics.
- GET /social-account via social-account.api.getSocialAccountsByPersona(http,personaId,filter); default offset 0, limit 100, where persona_id; spread filter can override scope. New workflow derives scope from durable auth/Persona state, not UI argument or arbitrary filter. Confirm pagination response and server ownership semantics.
- GET /social-account/:id/proxy, GET /proxies/:id, GET /social-account/:id/groups. Group flow is R7; do not reimplement.
- Existing CALL_EXTERNAL_SERVICE wrappers remain transitional; no new direct Axios in UI. Some legacy handlers use then without rejection response; new handlers should return structured errors.

## Storage ownership
ChromeAppStorageAdapter strips local: prefix; appStorage and extensionStorage share physical chrome.storage.local. Document localStorageService is separate.
| Key | Current writers / consumers | Target |
|---|---|---|
| allSocialAccounts | AuthContext, ChoosePlatform, SyncService, systemHandlers, R2 switch | source-bound catalog + compatibility projection |
| personaSocialAccounts | AuthContext, ChoosePlatform, R2 switch | projection only |
| personaFacebookAccounts | same, SyncService/systemHandlers | projection only |
| facebookAccounts | AuthContext, ChoosePlatform, switch; React GroupPage consumer | projection only |
| fbLoginMode | pages write string then object; AuthContext and reapply write object/string; SyncService, GroupPage, auth recovery, initialize read | active platform legacy object projection |
| tiktokLoginMode / threadsLoginMode / xLoginMode / youtubeLoginMode | pages / per-platform reads | compatibility until R3.3 migration |
| selectedPlatform | document helper / PlatformMetaBar | view selection vs committed active platform separated |
| fbLoginModeSelected / login:login-success-redirect | document flags / AppRoutes | UI projection only |
| personaSelection / selectedPersonaId | Background R2, legacy local mirror | Persona authority |
| extensionProxy / personaProxy / activeProxy | various | R4 |
| manualPlatformCookies / manualFacebookCookies | AuthContext, auth cleanup | R4 |
R3.3 should introduce one platform login state map of objects keyed by platform, plus committed activePlatform. Do not reuse fbLoginMode for scalar and object. Legacy projection fbLoginMode must remain object for legacy Background consumers and GroupPage; migrate readers before removing keys. Existing cleanup omits youtubeLoginMode; include new state keys in auth cleanup when introduced. Preserve manual-vs-auto policy through migration. Legacy missing/contradictory state not silently treated as ready; scope and revalidate.

## Platform capabilities
UI PLATFORMS and type validators include Facebook, TikTok, X, Threads, YouTube. Both normalizePersonaSocialAccount helpers allow only facebook/tiktok/x/threads, normalize twitter->x; missing platform defaults Facebook, missing status may be treated active, IDs accept account_id/id/social_account_id. Direct page/sync filters require active exactly, so policies differ. Embedded extraction dedupes platform:account_id but flat refresh does not consistently dedupe. YouTube is exposed UI but excluded from account normalization and its cookie domain list is empty. Both cookie domain helpers fall back to Facebook for empty mapping and can throw on unknown platform. R3 gate unsupported auto setup explicitly; preserve intended manual navigation where supported, do not clear Facebook for YouTube. Actual YouTube account-login support unverified; discuss before adding.
Cookie helper copies use XOR+base64 with environment prefix/key, return plaintext on failure and serialize object input directly. Empty prefix matches every string, decryption may attempt to decode plaintext. Compatibility not authenticated encryption. Do not expose credential payloads in new DTOs, logs or events. Existing raw arrays and raw persona mirror remain transitional; R4 security hardening needed.

## Proposed contracts (not implemented)
Prefer few business commands instead of per-storage-key commands.
- SOCIAL_ACCOUNT_GET_STATE {platform?: PlatformId}: source-bound catalog summary, revision and freshness; optional platform filter, no separate GET_BY_PLATFORM unless needed.
- SOCIAL_ACCOUNT_REFRESH {}: derive authenticated source and refresh; return summary. Distinguish known-empty success, malformed/failed response, stale same-source cache, source change; never use other-source cache. Explicit refresh should not silently succeed on network failure.
- PLATFORM_GET_STATE {platform?: PlatformId}: committed active platform and per-platform mode/account/status/revision.
- PLATFORM_CONFIGURE_LOGIN {platform,mode,accountId?,expectedRevision?}: validates source and account, prepares bounded local resource setup workflow. R3.4 decide completion acknowledgment and interim R4 bridge. No raw cookies/proxy supplied by caller.
- PLATFORM_REAPPLY_LOGIN {expectedPersonaRevision?}: coordinate after switch only; derive identity/state rather than accept arbitrary accounts. Consider internal operation vs public message in R3.5.
- PLATFORM_STATE_CHANGED: nonsecret invalidation hint only, R8.
Response {success:true,data:T} or {success:false,error:string,code:string}. Proposed codes AUTH_REQUIRED, PERSONA_REQUIRED, ACCOUNT_SOURCE_CHANGED, ACCOUNT_LOAD_FAILED, ACCOUNT_NOT_ASSIGNED, NO_ACCOUNTS, NO_COOKIES, UNSUPPORTED_PLATFORM, PLATFORM_CONFLICT, RESOURCE_SETUP_FAILED, RECONCILIATION_REQUIRED.
AccountSource = config {userId,sessionId,extensionConfigId} or persona {userId,sessionId,personaId,personaRevision}; decide how session generation/metadata refresh affects identity. Catalog stores source and revision with normalized full records in Background-owned durable storage, public AccountSummary only id/platform/name/status/hasCookies/hasProxy; no proxy passwords, cookie bytes, API keys. Existing UI raw consumers must migrate progressively; do not claim secrets removed just by adding safe summary. Persist replacement keys atomically per patch where possible; no cross-system transaction. Recheck source before commit, share existing session queue where appropriate, avoid nested enqueue; fence refresh vs switching/logout/recovery. Periodic sync integration must not create another authority. Account identity composite platform+accountId; preserve first-account default only within current platform/source, explicit ID validated. Missing proxy enrichment is separate status, not authorization to use stale proxy.
PlatformState: platform, mode auto/manual/null, selectedAccountId nullable, status unconfigured/configuring/ready/reconciliation_required, revision, binding to account source. ready means local setup acknowledged, NOT verified third-party login. Keep explicit intent separate from committed active platform. Unknown outcome cannot be labeled ready. Confirm resource ack semantics with R4.

## Findings and risks
S01 High: three refresh implementations differ in normalization/hydration/persistence.
S02 High: valid empty list or no Facebook subset leaves old arrays.
S03 High: no source binding on account caches; stale cross-persona/user/config reuse.
S04 High: fbLoginMode scalar/object collision and account_id shared across platforms.
S05 High: loginWithMode persists intent and proxy before cookie validation; partial failures.
S06 High: config truthiness differs from hasExtensionConfigId sentinel handling.
S07 High: background sync imports nonexistent user.api and non-exported config function (static source evidence); build unverified.
S08 High: background sync and legacy initialization are competing writers, cache/deep merge issues.
S09 High: YouTube unsupported account normalization, cookie cleanup fallback can clear Facebook.
S10 High: raw DTOs include credential fields, proxy helper logs and snapshot security need review; XOR is not strong encryption.
S11 Medium: ChoosePlatform resumes truthy saved object as if scalar, uses wrong error variable, no reliable finally.
S12 Medium: PlatformPage differs from ChoosePlatform refresh/error behavior; busy flags and route flags.
S13 High: switching and refresh resource operations not fully fenced against auth termination or other UI.
S14 High: GroupPage uses fbLoginMode.account_id without platform scope, fallback single Facebook account; migrate reader with R3.3, preserve query behavior.
S15 Medium: readPlatformLoginMode returns manual when absent and can reuse account_id across platform; distinguish missing from explicit manual.
S16 Medium: API filter scope override and default pagination limits; server contract unknown.
S17 Medium: initial auto does not clear old cookies and resource errors may be swallowed; R4.
S18 Medium: Background platform helper uses localStorage/window; service worker availability not assured. Do not use it as source of truth.
S19 Medium: R2 pending setup resume/route guard/recovery gaps remain; R2.5 not completed.
S20 Medium: selected platform committed before setup; UI flag may indicate completion without local ack.

## Implementation plan and gates
R3.2: SocialAccountClient/handlers, source resolution, strict list validation, normalized/deduped catalog, replacement projections incl empty, source guard, refresh call migration, address SyncService integration with smallest necessary API fix (validate actual signature before changes), no new proxy infrastructure. Tests for config vs persona, empty/malformed/error, wrong source, no user, stale refresh, missing proxy, twitter normalization, duplicate IDs, no credential fields in public responses.
R3.3: platform state map, legacy string/object migration, read/write compatibility, GroupPage and Background readers, committed vs UI-selected platform, cleanup on auth end. Tests per platform and cross-platform identity isolation.
R3.4: validated login preparation/setup, explicit account selection/default, mode intent/ack, error mapping, UI busy cleanup; keep resource executors transitional pending R4. Test no accounts, cookies missing, manual/auto, unsupported platform, failures, stale revisions.
R3.5: coordinate Persona switching/refetch and platform reapply; pending/uncertain state, same-target resume, queue and source guards, periodic sync ownership. Test logout/recovery overlap, pending/failed setup, stale account/proxy, UI closed/reopened.
R3.6: migrate residual consumers, remove duplicate methods only when safe, compile/test and integrated build. R2.5 and R1 verification backlog remains; do not claim completed.
