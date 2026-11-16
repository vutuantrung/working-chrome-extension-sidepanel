import { describe, expect, it, vi } from "vitest";
import { AuthClient } from "../../entrypoints/sidepanel/application/services/AuthClient";
import type { ExtensionRuntimePort } from "../../entrypoints/sidepanel/types/BrowserPorts";

function setup() {
  const sendMessage = vi.fn();
  const client = new AuthClient({ sendMessage } as unknown as ExtensionRuntimePort, 100);
  return { client, sendMessage };
}

describe("AuthClient", () => {
  it("uses AUTH_LOGIN and unwraps the typed result", async () => {
    const { client, sendMessage } = setup();
    const data = { user: { id: "user" }, isApikeySession: false, extensionConfig: null, configurationUnavailable: false };
    sendMessage.mockResolvedValue({ success: true, data });
    expect(await client.login("demo", "test", "ext")).toEqual(data);
    expect(sendMessage).toHaveBeenCalledWith({ type: "AUTH_LOGIN", inputs: { username: "demo", password: "test", extensionId: "ext" } });
  });
  it("uses AUTH_LOGIN_BY_API_KEY", async () => {
    const { client, sendMessage } = setup();
    sendMessage.mockResolvedValue({ success: true, data: { user: { id: "user" }, isApikeySession: true } });
    await client.loginByApiKey("test", "ext");
    expect(sendMessage).toHaveBeenCalledWith({ type: "AUTH_LOGIN_BY_API_KEY", inputs: { apiKey: "test", extensionId: "ext" } });
  });
  it("reads stored session state via Background", async () => {
    const { client, sendMessage } = setup();
    sendMessage.mockResolvedValue({ success: true, data: { user: null, isApikeySession: false } });
    expect(await client.getState()).toEqual({ user: null, isApikeySession: false });
    expect(sendMessage).toHaveBeenCalledWith({ type: "AUTH_GET_STATE" });
  });
  it("rejects server failure and missing response", async () => {
    const { client, sendMessage } = setup();
    sendMessage.mockResolvedValueOnce({ success: false, error: "Authentication failed" }).mockResolvedValueOnce(undefined);
    await expect(client.login("demo", "test", "ext")).rejects.toThrow("Authentication failed");
    await expect(client.getState()).rejects.toThrow("Invalid authentication response");
  });
});

describe("R1.2 auto-login client contract", () => {
  it.each([
    { status: "anonymous" },
    { status: "restored", user: { id: "user" }, isApikeySession: false },
    { status: "authenticated", session: { user: { id: "user" }, isApikeySession: true, extensionConfig: null, configurationUnavailable: false } },
  ])("forwards %j without sending stored credentials", async data => {
    const { client, sendMessage } = setup();
    sendMessage.mockResolvedValue({ success: true, data });
    expect(await client.autoLogin("ext")).toEqual(data);
    expect(sendMessage).toHaveBeenCalledExactlyOnceWith({
      type: "AUTH_AUTO_LOGIN", inputs: { extensionId: "ext" },
    });
  });

  it("rejects automatic authentication failure", async () => {
    const { client, sendMessage } = setup();
    sendMessage.mockResolvedValue({ success: false, error: "Authentication failed", code: "AUTH_FAILED" });
    await expect(client.autoLogin("ext")).rejects.toThrow("Authentication failed");
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });
});
