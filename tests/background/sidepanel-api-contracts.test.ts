import { describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => vi.fn());
vi.mock("../../entrypoints/sidepanel/application/services/SidepanelServices", () => ({
  externalServiceClient: { request },
}));
import api from "../../entrypoints/sidepanel/infrastructure/api";

const filter = { limit: 10 };
const schedule = { schedule_start_time: "08:00", schedule_end_time: "17:00", automation: true };
const profile = { id: "case", name: "demo", platform: "facebook", profile_url: "", origin_url: "", profile_id: "", description: "", created_time: 0, updated_time: 0 };
const images = ["data:image/png;base64,AA=="];
const metadata = [{ name: "demo", description: "", capture_time: 1 }];
const info = { name: "updated" };
const updates = [{ id: "image", name: "demo", description: "" }];
const deletes = ["old-image"];
const platforms = ["facebook"];
const types = ["group"];

const cases: Array<[string, () => Promise<unknown>, Record<string, unknown>]> = [
  ["login", () => api.extensionUser.loginApi("demo", "test", "ext"), { username: "demo", password: "test", extensionId: "ext" }],
  ["loginByApiKey", () => api.extensionUser.loginWithApikeyApi("test-key", "ext"), { apiKey: "test-key", extensionId: "ext" }],
  ["logout", () => api.extensionUser.logoutApi("ext"), { extensionId: "ext" }],
  ["updateExtensionSession", () => api.extensionUser.updateExtensionSession("session", schedule), { extensionId: "session", payload: schedule }],
  ["getExtensionConfigInfo", () => api.extensionUser.getExtensionConfigInfo("config", filter), { extensionConfigId: "config", filter }],
  ["deactivatePersona", () => api.extensionUser.deactivatePersona("persona"), { personaId: "persona" }],
  ["activatePersonaSession", () => api.extensionUser.activatePersonaSession("persona"), { personaId: "persona" }],
  ["getPersonas", () => api.persona.getPersonas("user", filter), { userId: "user", filter }],
  ["createPersona", () => api.persona.createPersona(), {}],
  ["getPersonaById", () => api.persona.getPersonaById("persona"), { persona_id: "persona" }],
  ["getProxiesByPersona", () => api.proxy.getProxiesByPersona("persona", filter), { personaId: "persona", filter }],
  ["getProxyInfo", () => api.proxy.getProxyInfo("proxy"), { proxy_id: "proxy" }],
  ["getSocialAccountProxy", () => api.socialAccount.getSocialAccountProxy("account"), { id: "account" }],
  ["getSocialAccountGroups", () => api.socialAccount.getSocialAccountGroups("account", 0, 10), { id: "account", offset: 0, limit: 10 }],
  ["getSocialAccountsByPersona", () => api.socialAccount.getSocialAccountsByPersona("persona", filter), { personaId: "persona", filter }],
  ["getProfileCases", () => api.profileCase.getProfileCases(filter), { filter }],
  ["createProfileCase", () => api.profileCase.createProfileCase(profile, images, metadata), { profileCase: profile, dataUrls: images, metadata }],
  ["patchCaseInfo", () => api.profileCase.patchCaseInfo("case", info, updates, deletes), { profileCaseId: "case", info, updateImages: updates, deleteIds: deletes }],
  ["postCaseImages", () => api.profileCase.postCaseImages("case", images, metadata), { profileCaseId: "case", dataUrls: images, metadata }],
  ["getMemberSourcesGroup", () => api.sourceMember.getMemberSourcesGroup("account", "joined", "demo", 0, 10, platforms, types), { accountId: "account", status: "joined", search: "demo", offset: 0, limit: 10, platform: platforms, type: types }],
  ["getMemberSourcesApi", () => api.sourceMember.getMemberSourcesApi("data", "joined", "demo", 0, 10, platforms, types, "user"), { data: "data", status: "joined", search: "demo", offset: 0, limit: 10, platform: platforms, type: types, assigneeId: "user" }],
];

describe("Sidepanel API wrapper contracts", () => {
  it.each(cases)("%s forwards the legacy operation and body", async (name, invoke, body) => {
    request.mockReset();
    const response = { marker: "mock response" };
    request.mockResolvedValue(response);
    expect(await invoke()).toBe(response);
    expect(request).toHaveBeenCalledTimes(1);
    const [operation, actualBody = {}] = request.mock.calls[0];
    expect(operation).toBe(name);
    expect(actualBody).toEqual(body);
  });
});
