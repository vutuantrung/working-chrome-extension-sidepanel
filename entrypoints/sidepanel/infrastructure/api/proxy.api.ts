import { externalServiceClient } from "../../application/services/SidepanelServices";

export const getProxiesByPersona = (personaId: string, filter?: any) =>
  externalServiceClient.request("getProxiesByPersona", { personaId, filter });
export const getProxyInfo = (proxy_id: string) =>
  externalServiceClient.request("getProxyInfo", { proxy_id });
