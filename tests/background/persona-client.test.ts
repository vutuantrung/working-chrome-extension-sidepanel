import { describe, expect, it, vi } from "vitest";
import { PersonaClient } from "../../entrypoints/sidepanel/application/services/PersonaClient";
import type { ExtensionRuntimePort } from "../../entrypoints/sidepanel/types/BrowserPorts";

function setup() {
  const sendMessage = vi.fn();
  const client = new PersonaClient({ sendMessage } as unknown as ExtensionRuntimePort);
  return { client, sendMessage };
}
const state = { selectedPersonaId: "p1", status: "active", revision: 2 };
describe("R2.3 PersonaClient", () => {
  it("activates by ID and expected revision", async () => {
    const { client, sendMessage } = setup();
    sendMessage.mockResolvedValue({ success: true, data: state });
    expect(await client.activate("p1", 1)).toEqual(state);
    expect(sendMessage).toHaveBeenCalledExactlyOnceWith({ type: "PERSONA_ACTIVATE", inputs: { personaId: "p1", expectedRevision: 1 } });
  });
  it("ensures default without caller user ID", async () => {
    const { client, sendMessage } = setup();
    sendMessage.mockResolvedValue({ success: true, data: state });
    expect(await client.ensureDefault()).toEqual(state);
    expect(sendMessage).toHaveBeenCalledExactlyOnceWith({ type: "PERSONA_ENSURE_DEFAULT" });
  });
  it("rejects selected rather than active status", async () => {
    const { client, sendMessage } = setup();
    sendMessage.mockResolvedValue({ success: true, data: { ...state, status: "selected" } });
    await expect(client.activate("p1")).rejects.toThrow("not acknowledged");
  });
  it("rejects mismatch and failure without automatic retry", async () => {
    const { client, sendMessage } = setup();
    sendMessage.mockResolvedValueOnce({ success: true, data: { ...state, selectedPersonaId: "p2" } })
      .mockResolvedValueOnce({ success: false, error: "Persona activation not confirmed" });
    await expect(client.activate("p1")).rejects.toThrow("not acknowledged");
    await expect(client.activate("p1")).rejects.toThrow("not confirmed");
    expect(sendMessage).toHaveBeenCalledTimes(2);
  });
});
