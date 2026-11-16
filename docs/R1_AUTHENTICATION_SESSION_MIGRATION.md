# R1 — Authentication & Session Migration

## Baseline
Sidepanel 3cad804fdb13f7f0c7b9ad2bbccd419016700f37; Background 0cf5a206bb1de325e9e81f16ffd51a117f44756f.
User API fixes: removed getSocialAccountInfo on both sides (21 operations remain), forwarded group platform/type filters, postCaseImages returns true. Updated stale tests and enforced upload ACK. Group API still sample-based.

## R1.1 implemented (verification pending)
Background commit 5e9373283b9b48ccc6a81e21d922e26d6520f04c. Existing runTimeOnMessageHandlerInternal adds AUTH_LOGIN, AUTH_LOGIN_BY_API_KEY, AUTH_GET_STATE and delegates to authHandlers.ts. No bootstrap, adapter or general service rewrites.
Authentication calls existing API implementation, normalizes user/session, enriches configuration session, writes user/isApikeySession via existing storage adapter and updates cached user, returns {success:true,data:{user,isApikeySession,extensionConfig,configurationUnavailable}}. Configuration fetch failure remains best effort; authentication failure replies with redacted error. AUTH_GET_STATE reads durable keys directly (not legacy cache lookup).
Sidepanel AuthClient injected with ExtensionRuntimePort. AuthContext replaces processLoginResponse with applyAuthenticatedSession; retains React state and existing persona/social/proxy setup, INITIALIZE_AFTER_LOGIN and START_PERIODIC_CHECK. All password/API-key login paths use new commands; initial restore uses AUTH_GET_STATE. API key expiry relogin now preserves true flag.
Compatibility: legacy login/logout API operations and existing runtime commands remain available. Both repositories must be updated together; no fallback to legacy login on ambiguous timeout (could duplicate mutation).

## Remaining
R1.2: move API-key retrieval/auto-login trigger, reconcile competing mount/poll/injection flows, deduplicate full authentication workflow; new Background login queue merely serializes sign-in commands, does not deduplicate or serialize legacy logout. R1.3: logout/restart cleanup with distinct cookie snapshot semantics. R1.4: expiry reauthentication and session events. R1.5: cleanup and actual integration tests.
The new login handler returns existing User/config DTOs (including sensitive fields used by legacy UI); sanitizing them requires migration of dependent workflows. Existing shared storage writers and legacy cache/lifecycle issues remain. Config fetch now occurs before persistence; authentication + config calls may take up to roughly two HTTP timeouts; AuthClient timeout 125s is not cancellation. No production runtime test, compile or build performed. Tests added but not executed. R0.3 runtime gate is still open. Test real extension identity, password/API-key login, config fetch failure, session restore, concurrent auto-login and logout before advancing.

## Local checks
Pull both main branches; pnpm compile and pnpm background:test in each repo, then test integrated extension with mock/nonproduction API. Existing standalone web has no Background transport; auth calls fail explicitly on missing response. No changes to browser infrastructure.

## R1.2 — Auto-login & Authentication Orchestration (implemented, verification pending)
Baselines: Sidepanel 64ac64a2f46e3dea69bf8102596498e1076d67e2; Background 5e9373283b9b48ccc6a81e21d922e26d6520f04c. Background implementation commit ce732f60d107eec315308ab8b909ebcde80926d4.
- New AUTH_AUTO_LOGIN command handled by existing runTimeOnMessageHandlerInternal -> handleAuthAutoLogin. Inputs only extensionId. Background reads durable user/isApikeySession/apikey through existing StorageService. Existing user wins; no key returns anonymous; key invokes existing authenticate normalization/persistence logic.
- Response discriminated by data.status: anonymous, restored (user and isApikeySession), authenticated (session AuthLoginResult). Errors use existing auth envelope and are redacted.
- Worker-scoped single-flight keyed by extension ID shares simultaneous auto requests; uses existing authentication queue and rereads durable state inside the queue, so previously queued manual login is respected. This is not a durable distributed lock or full logout serialization.
- AuthContext mount, key change notification and 5s UI polling delegate to one auto-login command. No API key value read or forwarded by ordinary startup auto-login. UI single-flight spans request and remaining local post-login/restore setup; manual form rejects overlap. Existing 401 event is ignored during sign-in/setup or when anonymous to avoid recursive expiry cleanup triggered by login. Other expiry behavior and legacy credential fallback remain for R1.4.
- Polling and storage notifications remain UI triggers; no new background startup/event listener or architecture change; closed Sidepanel does not initiate auto-login. Later polls may retry after failure; timeout is not cancellation. Duplicate UI setup across separate open Sidepanel instances and worker restart/partial init recovery remain open.
- Added 5 Background handler and 4 Sidepanel client test cases. No actual tests, compile or integrated extension build executed here. R0.3 runtime gate remains open. Verify concurrent mount/injection/poll, password login versus auto-login, invalid key, worker restart, storage persistence and no key reads by ordinary UI. Confirm both repositories deployed together.
- R1.3 logout/restart sequencing and R1.4 expiry orchestration remain pending; no changes to unrelated legacy external API response contracts. Latest user postCaseImages RequestResult typing mismatch remains outside this slice.
