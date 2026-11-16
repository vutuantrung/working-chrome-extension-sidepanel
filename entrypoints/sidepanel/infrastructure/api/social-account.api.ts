import { externalServiceClient } from "../../application/services/SidepanelServices";

export const getSocialAccountProxy = (id: string) =>
  externalServiceClient.request("getSocialAccountProxy", { id });
export const getSocialAccountGroups = (id: string, offset?: number, limit?: number) =>
  externalServiceClient.request("getSocialAccountGroups", { id, offset, limit });
export const getSocialAccountsByPersona = (personaId: string, filter?: any) =>
  externalServiceClient.request("getSocialAccountsByPersona", { personaId, filter });
