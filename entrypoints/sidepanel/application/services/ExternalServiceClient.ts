import type { ExtensionRuntimePort } from "../../types/BrowserPorts";

export type ExternalServiceName =
  | "login" | "loginByApiKey" | "logout" | "updateExtensionSession"
  | "getExtensionConfigInfo" | "deactivatePersona" | "activatePersonaSession"
  | "getPersonas" | "getPersonaById" | "createPersona"
  | "getProxiesByPersona" | "getProxyInfo"
  | "getSocialAccountProxy" | "getSocialAccountGroups"
  | "getSocialAccountsByPersona" | "getProfileCases" | "createProfileCase"
  | "patchCaseInfo" | "postCaseImages" | "getMemberSourcesGroup" | "getMemberSourcesApi";

/** Legacy Background gateway. Keep transport and API execution out of React. */
export class ExternalServiceClient {
  constructor(
    private readonly runtime: ExtensionRuntimePort,
    private readonly timeoutMs = 65_000,
  ) { }

  async request<T = any>(
    serviceName: ExternalServiceName,
    body: Record<string, unknown> = {},
  ): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Background request timed out")), this.timeoutMs);
      });
      const result = await Promise.race([
        this.runtime.sendMessage<T>({
          type: "CALL_EXTERNAL_SERVICE",
          inputs: { serviceName, body },
        }),
        timeout,
      ]);
      if (result && typeof result === "object" && "success" in result && result.success === false) {
        throw new Error("Background service request failed");
      }
      // postCaseImages is the only legacy operation whose success has no body.
      if (result == null && serviceName !== "postCaseImages") {
        throw new Error("Background returned no service response");
      }
      return result;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }
}
