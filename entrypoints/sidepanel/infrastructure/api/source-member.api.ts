import { externalServiceClient } from "../../application/services/SidepanelServices";

export const getMemberSourcesGroup = (
  accountId: string, status?: string, search?: string, offset?: number, limit?: number,
  platform?: string[], type?: string[],
) => externalServiceClient.request("getMemberSourcesGroup", { accountId, status, search, offset, limit, platform, type });

export const getMemberSourcesApi = (
  data?: string, status?: string, search?: string, offset?: number, limit?: number,
  platform?: string[], type?: string[], assigneeId?: string,
) => externalServiceClient.request("getMemberSourcesApi", { data, status, search, offset, limit, platform, type, assigneeId });
