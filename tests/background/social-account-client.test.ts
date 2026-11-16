import { describe, expect, it, vi } from "vitest";
import { SocialAccountClient } from "../../entrypoints/sidepanel/application/services/SocialAccountClient";
import type { ExtensionRuntimePort } from "../../entrypoints/sidepanel/types/BrowserPorts";
import type { SocialAccountPlatform } from "../../entrypoints/sidepanel/types/SocialAccountContracts";

const source = { type: "persona", userId: "u1", sessionId: "s1", personaId: "p1" };
const account = { accountId: "a1", platform: "facebook", name: "Example", status: "active", hasCookies: true, hasProxy: false };
const cached = { source, accounts: [account], status: "cached", revision: 1, refreshedAt: 1234 };
const uninitialized = { source, accounts: [], status: "uninitialized", revision: 0, refreshedAt: null };
function setup(timeoutMs = 125_000) {
  const sendMessage = vi.fn();
  return { sendMessage, client: new SocialAccountClient({ sendMessage } as unknown as ExtensionRuntimePort, timeoutMs) };
}

describe("R3.2 SocialAccountClient", () => {
  it("queries the catalog without caller-controlled identity", async () => {
    const { client, sendMessage } = setup();
    sendMessage.mockResolvedValue({ success: true, data: cached });
    expect(await client.getState()).toEqual(cached);
    expect(sendMessage).toHaveBeenCalledExactlyOnceWith({ type: "SOCIAL_ACCOUNT_GET_STATE" });
  });
  it("sends optional platform filter", async () => {
    const { client, sendMessage } = setup();
    sendMessage.mockResolvedValue({ success: true, data: cached });
    await client.getState("facebook");
    expect(sendMessage).toHaveBeenCalledExactlyOnceWith({ type: "SOCIAL_ACCOUNT_GET_STATE", inputs: { platform: "facebook" } });
  });
  it("refreshes without arbitrary source parameters and accepts empty catalog", async () => {
    const { client, sendMessage } = setup();
    const data = { ...cached, source: { type: "extension_config", userId: "u1", sessionId: "", extensionConfigId: "c1" }, accounts: [] };
    sendMessage.mockResolvedValue({ success: true, data });
    expect(await client.refresh()).toEqual(data);
    expect(sendMessage).toHaveBeenCalledExactlyOnceWith({ type: "SOCIAL_ACCOUNT_REFRESH" });
  });
  it("distinguishes uninitialized from known empty", async () => {
    const { client, sendMessage } = setup();
    sendMessage.mockResolvedValue({ success: true, data: uninitialized });
    expect(await client.getState()).toEqual(uninitialized);
    await expect(client.refresh()).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
  it("preserves known remote error code without forwarding unsafe error text", async () => {
    const { client, sendMessage } = setup();
    sendMessage.mockResolvedValue({ success: false, code: "ACCOUNT_SOURCE_CHANGED", error: "sensitive upstream payload" });
    await expect(client.refresh()).rejects.toMatchObject({ code: "ACCOUNT_SOURCE_CHANGED", message: "Account source changed" });
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });
  it("normalizes unknown error codes", async () => {
    const { client, sendMessage } = setup();
    sendMessage.mockResolvedValue({ success: false, code: "__proto__" });
    await expect(client.refresh()).rejects.toMatchObject({ code: "UNKNOWN_ERROR" });
  });
  it.each([null, {}, { success: true }, { success: true, data: { ...cached, revision: -1 } },
    { success: true, data: { ...cached, source: { ...source, personaId: "" } } },
    { success: true, data: { ...cached, accounts: [{ ...account, hasCookies: "yes" }] } },
    { success: true, data: { ...cached, accounts: [account, account] } },
    { success: true, data: { ...uninitialized, accounts: [account] } },
  ])("rejects malformed response %#", async response => {
    const { client, sendMessage } = setup();
    sendMessage.mockResolvedValue(response);
    await expect(client.getState()).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
  it("rejects platform mismatch", async () => {
    const { client, sendMessage } = setup();
    sendMessage.mockResolvedValue({ success: true, data: cached });
    await expect(client.getState("x")).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
  it("rejects unsupported platform before transport", async () => {
    const { client, sendMessage } = setup();
    await expect(client.getState("youtube" as SocialAccountPlatform)).rejects.toMatchObject({ code: "UNSUPPORTED_PLATFORM" });
    expect(sendMessage).not.toHaveBeenCalled();
  });
  it("projects only public fields even if unexpected credentials arrive", async () => {
    const { client, sendMessage } = setup();
    sendMessage.mockResolvedValue({ success: true, data: { ...cached, secret: "hidden", source: { ...source, apikey: "hidden" },
      accounts: [{ ...account, cookies: "hidden", proxy: { password: "hidden" } }] } });
    expect(await client.refresh()).toEqual(cached);
  });
  it("normalizes transport failure without retry", async () => {
    const { client, sendMessage } = setup();
    sendMessage.mockRejectedValue(new Error("transport payload"));
    await expect(client.refresh()).rejects.toMatchObject({ code: "TRANSPORT_FAILED" });
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });
  it("times out without automatic retry", async () => {
    vi.useFakeTimers();
    try {
      const { client, sendMessage } = setup(100);
      sendMessage.mockReturnValue(new Promise(() => {}));
      const result = expect(client.refresh()).rejects.toMatchObject({ code: "REQUEST_TIMEOUT" });
      await vi.advanceTimersByTimeAsync(100);
      await result;
      expect(sendMessage).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });
});
