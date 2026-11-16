import { describe, expect, it, vi } from "vitest";
import { PersonaClient } from "../../entrypoints/sidepanel/application/services/PersonaClient";
import type { ExtensionRuntimePort } from "../../entrypoints/sidepanel/types/BrowserPorts";
function setup() {
  const sendMessage = vi.fn();
  return { sendMessage, client: new PersonaClient({ sendMessage } as unknown as ExtensionRuntimePort) };
}
describe("R2.4 persona switching client", () => {
  it("uses one typed command for remote switching", async () => {
    const { client, sendMessage } = setup();
    const data = { selectedPersonaId: "p2", status: "active", revision: 3, resourceSetupPending: true };
    sendMessage.mockResolvedValue({ success: true, data });
    expect(await client.switch("p2", 1)).toEqual(data);
    expect(sendMessage).toHaveBeenCalledExactlyOnceWith({ type: "PERSONA_SWITCH", inputs: { personaId: "p2", expectedRevision: 1 } });
  });
  it("requires matching resource completion acknowledgment", async () => {
    const { client, sendMessage } = setup();
    const data = { selectedPersonaId: "p2", status: "active", revision: 4, resourceSetupPending: false };
    sendMessage.mockResolvedValue({ success: true, data });
    expect(await client.completeSwitchResources("p2", 3)).toEqual(data);
    expect(sendMessage).toHaveBeenCalledExactlyOnceWith({ type: "PERSONA_COMPLETE_SWITCH_RESOURCES", inputs: { personaId: "p2", expectedRevision: 3 } });
  });
  it("rejects uncertain mutation and does not retry", async () => {
    const { client, sendMessage } = setup();
    sendMessage.mockResolvedValue({ success: false, error: "Persona switch outcome is uncertain" });
    await expect(client.switch("p2", 1)).rejects.toThrow("uncertain");
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });
  it("rejects completion with pending resources", async () => {
    const { client, sendMessage } = setup();
    sendMessage.mockResolvedValue({ success: true, data: { selectedPersonaId: "p2", status: "active", resourceSetupPending: true } });
    await expect(client.completeSwitchResources("p2", 3)).rejects.toThrow("not acknowledged");
  });
});
