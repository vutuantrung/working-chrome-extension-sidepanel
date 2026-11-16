import { describe, expect, it, vi } from "vitest";
import { SocialAccountResourceReader } from "../../entrypoints/sidepanel/application/services/SocialAccountResourceReader";
import type { SocialAccountClient } from "../../entrypoints/sidepanel/application/services/SocialAccountClient";
import type { ExtensionStoragePort } from "../../entrypoints/sidepanel/types/BrowserPorts";
const source = { type: "persona", userId: "u", sessionId: "s", personaId: "p" };
const state = { source, status: "cached", revision: 1, refreshedAt: 100, accounts: [{ accountId: "a", platform: "facebook", status: "active", hasCookies: true, hasProxy: false }] };
const catalog = { source, revision: 1, refreshedAt: 100, accounts: [{ account_id: "a", platform: "facebook", status: "active", cookies: "test" }] };
function setup() {
  const getState = vi.fn().mockResolvedValue(state);
  const refresh = vi.fn().mockResolvedValue(state);
  const get = vi.fn().mockResolvedValue({ socialAccountCatalog: catalog });
  const reader = new SocialAccountResourceReader({ getState, refresh } as unknown as SocialAccountClient, { get } as unknown as ExtensionStoragePort);
  return { reader, getState, refresh, get };
}
describe("R3.2 transitional resource reader", () => {
  it("reads matching catalog only", async () => {
    const { reader, get } = setup();
    expect(await reader.read()).toEqual(catalog.accounts);
    expect(get).toHaveBeenCalledExactlyOnceWith(["socialAccountCatalog"]);
  });
  it("refreshes explicitly", async () => {
    const { reader, refresh } = setup();
    await reader.read(true); expect(refresh).toHaveBeenCalledTimes(1);
  });
  it("refreshes uninitialized state", async () => {
    const { reader, getState, refresh } = setup();
    getState.mockResolvedValueOnce({ ...state, status: "uninitialized", revision: 0, refreshedAt: null, accounts: [] });
    await reader.read(); expect(refresh).toHaveBeenCalledTimes(1);
  });
  it("rejects cross-persona data", async () => {
    const { reader, get } = setup();
    get.mockResolvedValue({ socialAccountCatalog: { ...catalog, source: { ...source, personaId: "other" } } });
    await expect(reader.read()).rejects.toMatchObject({ code: "ACCOUNT_SOURCE_CHANGED" });
  });
  it("rejects changed revision after storage read", async () => {
    const { reader, getState } = setup();
    getState.mockResolvedValueOnce(state).mockResolvedValueOnce({ ...state, revision: 2 });
    await expect(reader.read()).rejects.toMatchObject({ code: "ACCOUNT_SOURCE_CHANGED" });
  });
  it("rejects mismatching resource identities", async () => {
    const { reader, get } = setup();
    get.mockResolvedValue({ socialAccountCatalog: { ...catalog, accounts: [{ ...catalog.accounts[0], account_id: "other" }] } });
    await expect(reader.read()).rejects.toMatchObject({ code: "ACCOUNT_SOURCE_CHANGED" });
  });
  it("does not fall back to legacy arrays after refresh failure", async () => {
    const { reader, refresh, get } = setup();
    refresh.mockRejectedValue(new Error("refresh failed"));
    await expect(reader.read(true)).rejects.toThrow("refresh failed");
    expect(get).not.toHaveBeenCalled();
  });
});
