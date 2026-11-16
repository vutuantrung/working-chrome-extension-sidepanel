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
  private async requireActive(result: Promise<PersonaState>, personaId?: string): Promise<PersonaState> {
    const state = await result;
    if (state.status !== "active" || !state.selectedPersonaId ||
        (personaId !== undefined && state.selectedPersonaId !== personaId)) {
      throw new Error("Persona activation not acknowledged");
    }
    return state;
  }
  activate(personaId: string, expectedRevision?: number): Promise<PersonaState> {
    return this.requireActive(this.request<PersonaState>("PERSONA_ACTIVATE", {
      personaId, ...(expectedRevision !== undefined ? { expectedRevision } : {}),
    }), personaId);
  }
  ensureDefault(): Promise<PersonaState> {
    return this.requireActive(this.request<PersonaState>("PERSONA_ENSURE_DEFAULT"));
  }
  switch(personaId: string, expectedRevision?: number): Promise<PersonaState> {
    return this.requireActive(this.request<PersonaState>("PERSONA_SWITCH", {
      personaId, ...(expectedRevision !== undefined ? { expectedRevision } : {}),
    }), personaId);
  }
  async completeSwitchResources(personaId: string, expectedRevision: number): Promise<PersonaState> {
    const result = await this.requireActive(this.request<PersonaState>("PERSONA_COMPLETE_SWITCH_RESOURCES", {
      personaId, expectedRevision,
    }), personaId);
    if (result.resourceSetupPending !== false) throw new Error("Resource setup not acknowledged");
    return result;
  }
  select(personaId: string, expectedRevision?: number): Promise<PersonaState> {
    return this.request("PERSONA_SELECT", { personaId, ...(expectedRevision !== undefined ? { expectedRevision } : {}) });
  }
}
