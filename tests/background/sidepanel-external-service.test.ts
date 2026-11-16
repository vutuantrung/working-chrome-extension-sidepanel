import { describe, expect, it, vi } from "vitest";
import { ExternalServiceClient } from "../../entrypoints/sidepanel/application/services/ExternalServiceClient";
import type { ExtensionRuntimePort } from "../../entrypoints/sidepanel/types/BrowserPorts";

function setup() {
  const sendMessage = vi.fn();
  const client = new ExternalServiceClient({ sendMessage } as unknown as ExtensionRuntimePort, 100);
  return { client, sendMessage };
}

describe("Sidepanel external service bridge", () => {
  it("preserves the legacy envelope and response", async () => {
    const { client, sendMessage } = setup();
    sendMessage.mockResolvedValue({ data: [] });
    expect(await client.request("getPersonas", { userId: "demo" })).toEqual({ data: [] });
    expect(sendMessage).toHaveBeenCalledWith({
      type: "CALL_EXTERNAL_SERVICE",
      inputs: { serviceName: "getPersonas", body: { userId: "demo" } },
    });
  });
  it("rejects missing and explicit failure responses", async () => {
    const { client, sendMessage } = setup();
    sendMessage.mockResolvedValueOnce(undefined).mockResolvedValueOnce({ success: false });
    await expect(client.request("getPersonas")).rejects.toThrow("no service response");
    await expect(client.request("getPersonas")).rejects.toThrow("request failed");
  });
  it("requires explicit image upload acknowledgment", async () => {
    const { client, sendMessage } = setup();
    sendMessage.mockResolvedValueOnce(true).mockResolvedValueOnce(undefined).mockResolvedValueOnce(false);
    await expect(client.request("postCaseImages")).resolves.toBe(true);
    await expect(client.request("postCaseImages")).rejects.toThrow("did not acknowledge");
    await expect(client.request("postCaseImages")).rejects.toThrow("did not acknowledge");
  });
  it("propagates transport failure", async () => {
    const { client, sendMessage } = setup();
    sendMessage.mockRejectedValue(new Error("Connection closed"));
    await expect(client.request("login")).rejects.toThrow("Connection closed");
  });
  it("times out without retrying a command", async () => {
    const { client, sendMessage } = setup();
    sendMessage.mockReturnValue(new Promise(() => {}));
    await expect(client.request("login")).rejects.toThrow("timed out");
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });
});
