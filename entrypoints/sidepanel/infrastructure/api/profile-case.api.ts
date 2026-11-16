import { externalServiceClient } from "../../application/services/SidepanelServices";

import type { GetProfileCasesResponse, ProfileCase, RequestResult } from "../../types/types";

type EvidenceMetadata = { name: string; description: string; capture_time: number };
type CaseInfo = Partial<Pick<ProfileCase, "name" | "platform" | "profile_url" | "origin_url" | "description">>;
type ImageUpdate = { id: string; name: string; description: string };

export const getProfileCases = (filter?: any) =>
  externalServiceClient.request<GetProfileCasesResponse>("getProfileCases", { filter });

export const createProfileCase = (profileCase: ProfileCase, dataUrls: string[], metadata: EvidenceMetadata[]) =>
  externalServiceClient.request<ProfileCase>("createProfileCase", { profileCase, dataUrls, metadata });

export const patchCaseInfo = (profileCaseId: string, info: CaseInfo, updateImages: ImageUpdate[], deleteIds: string[]) =>
  externalServiceClient.request<ProfileCase>("patchCaseInfo", { profileCaseId, info, updateImages, deleteIds });

export const postCaseImages = (profileCaseId: string, dataUrls: string[], metadata: EvidenceMetadata[]) =>
  externalServiceClient.request<RequestResult<boolean>>("postCaseImages", { profileCaseId, dataUrls, metadata });
