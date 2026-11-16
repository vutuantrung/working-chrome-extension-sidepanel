# R2.1 — Persona Capability Audit & Contracts
Date: 2026-11-16. Status: static audit and proposed design; no production changes.
## Baselines and scope
- Sidepanel main: b73874fdc285b1a071a8f6c30743b1fdd3c48676
- Background main: 1d132663164ffa4ae86f9975924c1bcbc64aec3d
- R1 implemented but R0.3/R1.5 runtime gates remain open. No compile, tests or real extension executed here. Audit covers AuthContext, persona pages/components, AppRoutes, ChoosePlatform, helpers/types, API implementations, Background system/auth handlers and existing architecture; not an exhaustive scan of all consumers or backend server source.
- Existing runTimeOnMessageHandlerInternal remains the sole router; add focused persona handler(s) only as needed. No browser adapter/bootstrap refactor. Reuse HTTP APIs, StorageService and existing domain helpers. Contracts below are proposals, not implemented APIs.

## Capability map
| Capability | Existing owner/caller | Target |
|---|---|---|
| List personas | SelectPersona, SwitchPersona, ensureDefaultPersonaForExtensionConfig | Background persona query |
| Create when empty | SelectPersona mount and default ensure independently | Background ensure/prepare command, single-flight |
| Select | applyPersonaOnSelect, storePersonaSelection, persistSelectedPersonaId | Background validated selection |
| Restore | syncPersonaContextFromLocalStorage, post-login/restore | Background authoritative read, UI projection |
| Activate | SelectPersona and default ensure, activatePersonaSessionApi (no active call observed in AuthContext) | Background activation workflow |
| Switch | AuthContext.switchPersona | Background coordinated workflow |
| Resolve proxy | resolvePersonaProxy, applyEffectiveProxy | Proxy boundary R4; temporary internal reuse |
| Account projection | persistPersonaSocialAccounts, getPersonaFacebookAccounts | Persona resource association + Social Account boundary R3 |
| Platform reapply | reapplyPlatformLoginAfterPersonaSwitch | R2.4 orchestration using R3/R4 capabilities |
| UI state | SelectPersona/SwitchPersona, AppRoutes | Sidepanel |
| Runtime initialization | INITIALIZE_AFTER_LOGIN/systemHandlers | Existing Background handler, not a new router |

## Existing flows (observed)
A. First selection without config: SelectPersona useEffect lists by user.id; zero -> create; one -> auto-select; multiple -> render selection. activateAndProceed calls activation (catch and continue), then applyPersonaOnSelect fetches details (fallback original record), stores ID and full document-local snapshot, applies persona resources/proxy, navigates to /facebook-login-mode. Activation failure can look successful.
B. Config-bound default: ensureDefaultPersonaForExtensionConfig checks document-local ID; returns if present without ownership/validity check; otherwise list -> first or create -> store -> best-effort activation. Called from post-login and restore, independent of selection page. Switching is forbidden for configured sessions by current UI/business check.
C. Switch: SwitchPersona lists, filters current local ID, asks confirmation. AuthContext checks hasExtensionConfig, normalizes target, reads prior local ID, deactivates previous then activates target then loads detail; persists ID/snapshot, clears profile/profileId, applies persona proxy/accounts, reapplies selected platform login, calls INITIALIZE_AFTER_LOGIN best effort. No rollback/atomicity; activation can succeed before detail failure; same-target can still activate. No explicit session-wide switch lock.
D. Restore: local JSON selectedPersona -> persist ID -> resolve proxy (possibly unscoped cached proxy) -> persist accounts. Runs in login, restore, getPersonaFacebookAccounts and related platform setup. Background can operate without the document snapshot but does not yet own full persona restore.

## Existing HTTP endpoints and transport
Legacy CALL_EXTERNAL_SERVICE routes getPersonas(userId,filter), createPersona(), getPersonaById(persona_id), activatePersonaSession(personaId), deactivatePersona(personaId). GET /personas default offset 0, limit 500, where user_id; spread filter can override defaults including where. POST /personas/assign-to-user uses VN, empty topic/resources and facebook defaults. GET /personas/:id; PATCH /extension-sessions/active-persona/:id and /inactive-persona/:id. HTTP response shapes/ownership enforcement are not verified against live server. Preserve legacy endpoints and defaults during migration. Do not pass arbitrary filter overrides to new business commands. For pagination beyond 500, confirm endpoint metadata before automatic create on empty/invalid list. Distinguish errors from actual empty list.

## State ownership and dependencies
- Durable extension storage (ChromeAppStorageAdapter strips local: prefix): user, selectedPersonaId, personaProxy, personaSocialAccounts, personaFacebookAccounts, allSocialAccounts, facebookAccounts, activeProxy, profile/profileId, fbLoginMode and per-platform login-mode keys. Background also writes cache/settings/accounts/proxy via handleInitializeAfterLogin and shared storage service.
- Document local storage: selectedPersonaId, selectedPersona (full raw JSON), fbLoginModeSelected, selected platform. AppRoutes gates navigation using selectedPersonaId + localStorageSync; ChoosePlatform reads selectedPersonaId to query accounts. SwitchPersona filters by local ID. Preserve compatibility mirrors until consumers migrated. Document values are not authorization or durable authority.
- Proposed authoritative selection: existing durable selectedPersonaId plus owner binding (userId and auth session identity) and minimal revisioned metadata, e.g. personaSelection {userId, personaId, revision, status}. No full credential-bearing DTO in localStorage or event. Decide exact migration schema in R2.2, ensure legacy cleanup removes new keys, prevent stale cache resurrection. Reconcile mismatched legacy ID by verifying ownership through server; never silently import a previous user's local snapshot. Full backend persona/resource records remain in Background.
- Existing API wrappers return raw HTTP payload, parser parseList accepts array or data array else [] and parsePersonaRecord casts object without validating id. New commands normalize and validate; malformed list is error not empty.
- Existing Background utils/helpers/proxy.ts already exports extractPersonaProxy, normalizePersonaSocialAccount, extractPersonaSocialAccounts, findPersonaSocialAccountProxy, resolveEffectiveProxy, etc. Reuse, do not duplicate implementations; review parity before changing resource behavior.
- Config-bound persona is selection/activation only; extension config continues to own account/proxy precedence. Non-config persona owns assigned resources; keep active platform selection and auto/manual behavior. No raw browser calls outside existing browser adapters. UI passes selected platform/login-selected flags only where needed until R3.
- Auth queue currently serializes new auth commands, not Persona operations. R2.2 read-only snapshot and selection guarded by current durable identity; R2.3/R2.4 mutation coordination with Auth must be implemented, not assumed. Do not recursively enqueue on same queue. On session changed/timeout return reconciliation status; no automatic repeat of unsafe mutation.

## Proposed contracts (not implemented)
Use RequestResult<T> compatible envelope: {success:true,data:T} or {success:false,error:string,code:string, retryable?:boolean}. Failure may include safe reconciliation status, not raw API error. Names proposed below; avoid generic privileged dispatch.
| Type | Inputs | Successful data | Phase |
|---|---|---|---|
| PERSONA_GET_STATE | none | PersonaState | R2.2 |
| PERSONA_PREPARE_SELECTION | none | {state, candidates, status: "selection_required" or "ready"} | R2.2–R2.3 |
| PERSONA_SELECT | personaId, expectedRevision? | PersonaState | R2.2 |
| PERSONA_ACTIVATE | personaId, expectedRevision? | PersonaState | R2.3 |
| PERSONA_SWITCH | personaId, expectedRevision?, platformContext? | PersonaState | R2.4 |
| PERSONA_STATE_CHANGED (notification) | none | revision/invalidation hint | R2.5/R8 |
- Background derives authenticated user from durable storage, not caller-provided userId or raw persona. Validate id and ownership, config switching rule, session identity, target membership and status consistently with backend behavior (confirm status eligibility). Never assume local ID is proof of access.
- PersonaSummary minimal for cards: id, first_name, last_name, nickname, job, gender, country, status. PersonaState proposed: selectedPersonaId:string|null, selectedPersona:PersonaSummary|null, mode:"config_bound"|"persona_bound", canSwitch:boolean, revision:number, status:"unselected"|"selected"|"active"|"reconciliation_required". selected does not assert activated. Candidate list returns UI-safe summaries only. No cookies, proxy credentials, secrets or full raw records in the new DTO. UI compatibility during migration may still rely on old data until R3/R4. Error codes: AUTH_REQUIRED, SESSION_CHANGED, PERSONA_INVALID_ID, PERSONA_NOT_FOUND, PERSONA_FORBIDDEN, PERSONA_SWITCH_NOT_ALLOWED, PERSONA_LOAD_FAILED, PERSONA_ACTIVATION_FAILED, PERSONA_CONFLICT, PERSONA_RECONCILIATION_REQUIRED. Error taxonomy is design proposal.
- PREPARE selection: read list and return candidate decision; initially do not implicitly activate. Zero -> create only after confirmed empty and single-flight/recheck. One -> select policy; multiple non-config -> user selection; config default -> first (preserve current policy unless changed). Split preparation and activation carefully so no route advances until required server acknowledgment. R2.2 should not remove legacy activation until R2.3 wired; transitional UI must not duplicate activation.
- Switch target: validate target/details and resource availability before deactivating previous; same target no-op when confirmed active, not when status unknown; serialize with auth; activate target; commit selected identity and project resources; invalidate old profile; reapply platform login and proxy; initialize existing Background state. Server mutations and browser changes are not an ACID transaction. If partial failure, attempt compensating activation only when safe and explicitly report reconciliation_required if unknown, do not pretend rollback succeeded. Verify server activation/inactivation semantics and compensation before implementing.
- UI keeps candidate choice, confirmation, loading/error, route navigation. PersonaClient wraps ExtensionRuntimePort, not new router. Use temporary AuthContext facade to avoid breaking callers. PersonaContext only if useful; do not create contexts merely to move code. Eventually remove local raw snapshot and AuthContext persona API after all callers migrated.

## Findings / risk register
P-01 High: duplicate create paths on mount/default ensure; StrictMode and multiple UIs can race. Single-flight and confirmed empty, backend idempotency unknown.
P-02 High: local selected ID/full snapshot vs durable ID, no ownership binding; logout/recovery across UI instances may leave stale local state.
P-03 High: activation errors swallowed in first selection and default ensure; UI route progresses despite failure.
P-04 High: deactivation before verifying target/detail; partial server/client state, no compensation.
P-05 High: persistPersonaSocialAccounts keeps existing allSocialAccounts when new data lacks proxy; empty new list does not clear old projection. Can retain previous persona account data. Review and test before changing semantics.
P-06 High: cached personaProxy not keyed by persona; restore may use prior persona proxy. Reapply may prefer stored hydrated accounts from prior selection; validate ownership and clear stale resources.
P-07 High: manual mode cookie clearing and snapshot deletion, automatic mode selects matching account or first; failure/missing cookies may not fail switch. R2.4 must preserve explicit product semantics and expose partial outcomes; R3/R4 own implementation.
P-08 Medium: parseList silently treats malformed as empty; parsePersonaRecord casts without id; potential erroneous create.
P-09 High: filter spread can override user scope in legacy getPersonas. New commands derive user and whitelist filters; server access control unknown.
P-10 High: auth generation/queue worker-local, legacy commands outside queue; persona switch may race auth cleanup/recovery. R1 runtime gate still open.
P-11 Medium: AppRoutes uses localStorageSync and local ID as route prerequisite. Need compatibility projection and startup reconciliation.
P-12 Medium: INITIALIZE_AFTER_LOGIN reads cached state, acknowledges before delayed injection; not full completion guarantee. Existing storage cache miss recursion and external handler rejection issues remain.
P-13 Medium: fbLoginMode object/string writes target same key for facebook; must not normalize silently in R2.2. Preserve and test platform semantics.
P-14 Medium: raw persona/social DTO may contain sensitive assigned resource info; minimize new contracts; do not remove legacy data until consumer migration.
P-15 Low: activatePersonaSessionApi appears unused inside AuthContext; verify wider consumers before removal. Commented SelectPersona implementations not runtime code.

## Staged implementation and acceptance
R2.2 Selection/Persistence: typed PersonaClient and focused handler, authoritative state/validated selection, compatibility mirrors/route guards, normalized list/prepare without duplicate create. Test no user, wrong owner, malformed response, empty list, 1/many, config/nonconfig, stale local/durable mismatch, session changes, concurrent prepare and no duplicate mutation. Preserve existing activation workflow until R2.3.
R2.3 Activation: compose select/activate safely, explicit server ACK and failure, remove duplicate activation paths, update post-login/default ensure; test API failure and malformed target; verify server return semantics including empty success.
R2.4 Switching: validate config restriction in Background, target before deactivation, serialize auth/persona, explicit partial failure/reconciliation, resource application/initialization adapters; test same target, concurrent switch/logout/recovery, stale account/proxy, manual/auto cookie conditions, profile invalidation and failed activation/compensation.
R2.5 Cleanup/Testing: migrate remaining persona callers, remove unused methods/legacy mirrors only when safe, verify real extension compile/build/round trip, reload and multi-instance behavior. Full state sync R8.
Entry gate recommendation: run pnpm compile and pnpm background:test on both baseline repos, actual combined extension build and R1 401/recovery smoke tests. No claim these passed. R2.1 design complete, implementation and verification remain pending.
