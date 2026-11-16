import type { ExtensionRuntimePort } from "../../types/BrowserPorts";

export class ExtensionCommandService {
  constructor(private readonly runtime: ExtensionRuntimePort) { }

  getExtensionId(): string {
    return this.runtime.getExtensionId();
  }

  getVersion(fallback = "0.0.0"): string {
    return this.runtime.getVersion(fallback);
  }

  subscribe(listener: Parameters<ExtensionRuntimePort["subscribe"]>[0]) {
    return this.runtime.subscribe(listener);
  }

  async getSettings<T = any>(): Promise<T | null> {
    const response = await this.runtime.sendMessage<any>({ type: "GET_SETTINGS" });
    return response?.data ?? null;
  }

  async getUserInfo<T = any>(): Promise<T | null> {
    const response = await this.runtime.sendMessage<any>({ type: "GET_USERINFO" });
    return response?.data ?? null;
  }

  async saveSettings(data: any): Promise<boolean> {
    const setSettingsRes = await this.runtime.sendMessage<any>({
      type: "SET_SETTINGS",
      inputs: { data },
    });

    if (setSettingsRes?.success !== true) {
      return false;
    }

    const setProxyRes = await this.runtime.sendMessage<any>({
      type: "SET_PROXY",
      inputs: { extension_proxy: data?.proxy },
    });

    return setProxyRes?.success === true;
  }

  async initializeAfterLogin(
    extensionSession: unknown,
    context: Record<string, unknown> = {},
    requireAcknowledgment = false,
  ): Promise<void> {
    const response = await this.runtime.sendMessage<any>({
      type: "INITIALIZE_AFTER_LOGIN",
      inputs: {
        extension_session: extensionSession,
        ...context,
      },
    });
    if (requireAcknowledgment && response?.success !== true) throw new Error("Background initialization not acknowledged");
  }

  async startPeriodicCheck(): Promise<void> {
    await this.runtime.sendMessage({ type: "START_PERIODIC_CHECK" });
  }

  async clearDataAfterLogout(): Promise<void> {
    await this.runtime.sendMessage({ type: "CLEAR_DATA_AFTER_LOGOUT" });
  }

  async setProxy(extensionProxy: unknown, requireAcknowledgment = false): Promise<void> {
    const response = await this.runtime.sendMessage<any>({
      type: "SET_PROXY",
      inputs: { extension_proxy: extensionProxy },
    });
    if (requireAcknowledgment && response?.success !== true) throw new Error("Proxy setup not acknowledged");
  }

  async getFacebookAccountCache<T = any>(): Promise<T | null> {
    const response = await this.runtime.sendMessage<any>({
      type: "GET_FB_ACCOUNT_CACHE",
    });
    return response?.ok && response?.data ? response.data : null;
  }

  async cancelTask(taskId: string): Promise<void> {
    await this.runtime.sendMessage({
      type: "CANCEL_TASK",
      inputs: { taskId },
    });
  }
}
