# R0.3 — Integration Verification

Date: 2026-11-16. Status: STATIC VERIFIED WITH GAPS; runtime gate OPEN.

## Scope and baseline
- Sidepanel main: [65141b0](https://github.com/vutuantrung/working-chrome-extension-sidepanel/tree/65141b0fd02d3ec27c92849b18db26534e7a08e5)
- Background main: [6e78e2a](https://github.com/vutuantrung/working-chrome-extension-background/tree/6e78e2adb18155d3c0c34b98b0230ca99a36c82a)
- No Background edits, no bootstrap/service refactor, no production Sidepanel logic edits. Only verification docs/tests.
- GitHub connector reads succeeded. Local git ls-remote failed DNS resolution for github.com; pnpm unavailable. Full compile/build/Vitest/Playwright not executed. Do not interpret static matches as runtime success. A broad source scan exceeded connector call limits; review covers inspected callers, not every component.

## Contract comparison (actual static extraction)
Compared active externalServiceClient.request calls in six API files with case labels and body destructuring in Background handlers/extension/externalServiceHandler.ts. 22/22 operations found; 21/22 exact body key sets, one extra-key mismatch. No handler-required destructured keys missing from wrapper definitions. Optional arguments can still be absent at runtime.

| Operation | Body keys | Static finding |
|---|---|---|
| login | username,password,extensionId | match |
| loginByApiKey | apiKey,extensionId | match; maps to loginByApikey |
| logout | extensionId | match; empty-response semantics verify |
| updateExtensionSession | extensionId,payload | match; verify session ID and empty response |
| getExtensionConfigInfo | extensionConfigId,filter | match |
| deactivatePersona | personaId | match; empty response verify |
| activatePersonaSession | personaId | match |
| getPersonas | userId,filter | match |
| createPersona | none (default {}) | match |
| getPersonaById | persona_id | match |
| getProxiesByPersona | personaId,filter | match |
| getProxyInfo | proxy_id | match |
| getSocialAccountProxy | id | match |
| getSocialAccountInfo | id | keys match, implementation currently calls /social-account/{id}/proxy, semantic mismatch suspected |
| getSocialAccountGroups | id,offset,limit | match |
| getSocialAccountsByPersona | personaId,filter | match |
| getProfileCases | filter | match |
| createProfileCase | profileCase,dataUrls,metadata | match; multipart in Background |
| patchCaseInfo | profileCaseId,info,updateImages,deleteIds | match |
| postCaseImages | profileCaseId,dataUrls,metadata | match; void response ambiguous |
| getMemberSourcesGroup | accountId,status,search,offset,limit,platform,type | platform/type dropped in handler; API still sample-based |
| getMemberSourcesApi | data,status,search,offset,limit,platform,type,assigneeId | match |

Transport is CALL_EXTERNAL_SERVICE with inputs.serviceName/body. Existing runTimeOnMessageHandlerInternal dispatches to handleExternalApiCall and returns true. Successful result is raw HTTP response body, not a uniform response envelope. No new message type needed for R0.3. Nine legacy ExtensionCommandService message types also have dispatch cases (GET_SETTINGS, SET_SETTINGS, GET_USERINFO, SET_PROXY, INITIALIZE_AFTER_LOGIN, CLEAR_DATA_AFTER_LOGOUT, START_PERIODIC_CHECK, GET_FB_ACCOUNT_CACHE, CANCEL_TASK).

## Caller review
Inspected AuthContext, AutomationPage, ChoosePlatform, SelectPersona, SwitchPersona, EvidenceStudioPage, use-eviden-studio, GroupPage. Active API references in these files are imported through the existing API facade or source-member wrapper. AutomationPage now uses api.extensionUser.updateExtensionSession. No direct HTTP execution in the six active API wrapper files. Old source-member HTTP code is commented out. No full-project compile yet.
AuthContext still owns login response normalization, session persistence/restoration, persona activation, social account hydration, cookie changes, proxy resolution, navigation. AutomationPage still orchestrates configuration and session updates; Evidence hook still orchestrates multi-request saves; GroupPage still reads selected account from storage. Move one business use case at a time after verification.

## Gaps / runtime gate
| ID | Finding | Verification or next action |
|---|---|---|
| IV-01 | Sidepanel tree has only entrypoints/sidepanel; WXT config references missing Background entrypoint. | Assemble both source trees under one extension identity in integration workspace, verify generated manifest and both generated entrypoints. Do not load as two independent extensions. |
| IV-02 | Reverted Background storage cache miss recursion and async listener registration. | Real worker wake-up GET_SETTINGS/GET_USERINFO; missing keys must complete. Do not refactor infrastructure in this phase; record blockers for explicit decision. |
| IV-03 | Legacy external handler starts promises with .then but does not await or return them. | Mock HTTP rejection and verify caller rejects (transport closure or timeout); cannot guarantee structured server error. Future handler-specific fix only when needed and approved. |
| IV-04 | postCaseImages returns void; client allows null/undefined; could mistake absent response for success. Other mutating endpoints may have empty responses. | Verify actual endpoint behavior and ACK contract before any migration that clears drafts. |
| IV-05 | getMemberSourcesGroup ignores platform/type at dispatch, uses hardcoded sample ID and returns sample data; status filtering also suspect. | Confirm correct group endpoint/account identity and filters with user before changing Background business behavior. |
| IV-06 | getSocialAccountInfo currently calls proxy endpoint. | Verify intended server endpoint before correction. |
| IV-07 | ExternalServiceClient checks success:false and nullish result but has no per-operation runtime schema. | Validate result DTOs and error semantics during R1; timeout does not cancel server execution. |
| IV-08 | Existing Sidepanel Playwright suite uses standalone fixture, not production Background. | Use actual integrated extension + mock API for end-to-end gate; fixture test alone insufficient. |
| IV-09 | Standalone Web rejects CALL_EXTERNAL_SERVICE; Firefox Background not supported. | Chrome only for current integration; gallery injected mock separate. |

## Added tests
tests/background/sidepanel-api-contracts.test.ts: 22 parameterized wrapper tests use mocked ExternalServiceClient, compare operation/body and response forwarding. Existing sidepanel-external-service.test.ts: 5 transport tests. These are Sidepanel unit tests, NOT actual Background execution or HTTP/network tests. Not run in this environment.

## Local verification procedure
1. git pull origin main in both repositories. Confirm revisions; use isolated integration workspace (do not overwrite either repo). Decide assembly workflow with existing production repo: use its actual build base, place audited Background and Sidepanel entrypoints together, preserve required content scripts/assets/config/dependencies. Do not assume copying just two folders is a complete production extension.
2. In Sidepanel: pnpm install --frozen-lockfile; pnpm compile; pnpm background:test. In actual integrated workspace: pnpm compile; pnpm build. Inspect generated manifest background.service_worker and side_panel.default_path and load unpacked Chrome extension.
3. With mocked HTTP or nonproduction test account, verify request from actual Sidepanel reaches actual Background handler: login, restore, persona list, settings, proxy state, group filters, evidence list/create/update/upload; no real automation or production account mutations. Inspect worker logs and runtime errors.
4. Stop the worker in Chrome DevTools, reopen Sidepanel, repeat a read request. Verify no hang on cache miss. Test HTTP rejection, missing receiver and invalid operation. Close/reopen Sidepanel and verify persisted state. Do not retry mutation automatically.
5. Record actual command outputs and failure cases; fix only necessary new or existing message handlers within agreed scope.

## Exit criteria
- [x] Pin revisions and compare all 22 operation names.
- [x] Compare body fields, identify known semantic gaps.
- [x] Inspect priority caller imports and identify remaining business ownership.
- [x] Add wrapper regression coverage.
- [ ] Execute compile and tests.
- [ ] Verify actual same-extension build and real runtime round trip.
- [ ] Resolve or explicitly accept blockers relevant to R1.

R1 recommended first vertical slice: Authentication & Session. Keep runTimeOnMessageHandlerInternal as router; add business message type only if needed, delegate to focused handler; preserve existing transport and browser abstractions. No Background architecture changes. R0.3 is not fully passed until runtime gate closes.

## Re-verification at latest checkpoint — 2026-11-16

This addendum supersedes the historical counts and findings above, not the runtime gate.
- Sidepanel: [5063c72](https://github.com/vutuantrung/working-chrome-extension-sidepanel/tree/5063c72370c917717d498acb4e340c0392a494f9)
- Background: [5e93732](https://github.com/vutuantrung/working-chrome-extension-background/tree/5e9373283b9b48ccc6a81e21d922e26d6520f04c)
- Static extraction from all six API client files and externalServiceHandler.ts: 21/21 operation names and exact destructured body key sets match; no missing wrappers. Historical 22-operation matrix superseded: getSocialAccountInfo removed symmetrically, group platform/type now forwarded, postCaseImages requires literal true acknowledgment (Background implementation returns true).
- 9 ExtensionCommandService commands and 3 AuthClient commands all have matching dispatch cases in runtimeHandler.ts. CALL_EXTERNAL_SERVICE remains registered. AuthClient uses typed success/data envelopes; legacy external calls preserve raw payloads. No new message type required for verification.
- Existing test inventory: 21 parameterized API wrapper cases, 5 external transport tests, 4 AuthClient tests, 5 Background auth handler tests. Reviewed source, not executed. Mock tests do not prove actual message router or browser integration.
- Remaining blockers: the two projects are separate source trees; same-extension identity and generated manifest must be verified using the production assembly. Background legacy cache miss recursion/async listener registration and external HTTP rejection behavior remain. Group implementation still sample-based despite filter forwarding. Verify empty responses from other mutation endpoints and login/config/logout concurrency. Auth state restoration reads durable storage directly now, but subsequent legacy commands can still hit old cache path. New auth login serializes sign-ins only. Do not treat timeout as cancellation or retry mutation automatically.
- Local attempt: Node and global tsc available, pnpm not on PATH; git ls-remote failed DNS resolution for github.com. GitHub connector reads available. No full compile/build/Vitest/Chrome execution possible in this session. No production source changes in this re-verification.

### Runtime acceptance checklist (still open)
| Gate | Expected evidence |
|---|---|
| G1 | Both repos pinned to compatible revisions; pnpm compile and background:test outputs for both |
| G2 | Actual assembly build succeeds, generated manifest points to existing worker and sidepanel artifacts under one extension ID |
| G3 | From actual Sidepanel: password/API-key login and AUTH_GET_STATE round trip with a test account; verify durable state and error response |
| G4 | Stop/restart worker, then GET_SETTINGS and GET_USERINFO on cold/missing cache; verify no hang |
| G5 | Legacy external API failure, missing receiver, unauthorized response; no false success or duplicate mutation |
| G6 | Evidence upload explicit true ACK; session update/logout empty responses checked; group endpoint/sample issue documented or resolved |
| G7 | Close/reopen Sidepanel; verify session and UI restoration; test concurrent login/logout in nonproduction environment |

Status: static contracts verified, runtime gate OPEN. R1.1 is already implemented in current source; recommend completing G1–G4 before deeper auth migration. No Background refactor.
