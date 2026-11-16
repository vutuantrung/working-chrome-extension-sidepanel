import { externalServiceClient } from "../../application/services/SidepanelServices";

export interface UpdateExtensionSessionPayload {
  schedule_start_time: string;
  schedule_end_time: string;
  automation?: boolean;
}

export const loginApi = (username: string, password: string, extensionId: string) =>
  externalServiceClient.request("login", { username, password, extensionId });

export const loginWithApikeyApi = (apiKey: string, extensionId: string) =>
  externalServiceClient.request("loginByApiKey", { apiKey, extensionId });

export const logoutApi = (extensionId: string) =>
  externalServiceClient.request("logout", { extensionId });

export const updateExtensionSession = (extensionId: string, payload: UpdateExtensionSessionPayload) =>
  externalServiceClient.request("updateExtensionSession", { extensionId, payload });

export const getExtensionConfigInfo = (extensionConfigId: string, filter?: any) =>
  externalServiceClient.request("getExtensionConfigInfo", { extensionConfigId, filter });

export const deactivatePersona = (personaId: string) =>
  externalServiceClient.request("deactivatePersona", { personaId });

export const activatePersonaSession = (personaId: string) =>
  externalServiceClient.request("activatePersonaSession", { personaId });
