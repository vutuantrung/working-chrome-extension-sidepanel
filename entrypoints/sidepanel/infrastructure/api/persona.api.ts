import { externalServiceClient } from "../../application/services/SidepanelServices";

export const getPersonas = (userId: string, filter?: any) =>
  externalServiceClient.request("getPersonas", { userId, filter });
export const createPersona = () =>
  externalServiceClient.request("createPersona");
export const getPersonaById = (persona_id: string) =>
  externalServiceClient.request("getPersonaById", { persona_id });
