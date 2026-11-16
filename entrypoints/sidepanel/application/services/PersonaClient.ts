import type { ExtensionRuntimePort } from "../../types/BrowserPorts";
import type { PersonaState, PersonaPreparation } from "../../types/PersonaContracts";

type Result<T> = { success: true; data: T } | { success: false; error?: string; code?: string };

export class PersonaClient {
  constructor(private readonly runtime: ExtensionRuntimePort) {}

  private async request<T>(type: string, inputs?: Record<string, unknown>): Promise<T> {
    const response = await this.runtime.sendMessage<Result<T>>({ type, ...(inputs ? { inputs } : {}) });
    if (!response || response.success !== true || response.data == null) {
      throw new Error(response?.success === false ? response.error || "Persona operation failed" : "Invalid persona response");
    }
    return response.data;
  }
  getState(): Promise<PersonaState> {
    return this.request("PERSONA_GET_STATE");
  }
  prepareSelection(): Promise<PersonaPreparation> {
    return this.request("PERSONA_PREPARE_SELECTION");
  }
  select(personaId: string, expectedRevision?: number): Promise<PersonaState> {
    return this.request("PERSONA_SELECT", { personaId, ...(expectedRevision !== undefined ? { expectedRevision } : {}) });
  }
}
