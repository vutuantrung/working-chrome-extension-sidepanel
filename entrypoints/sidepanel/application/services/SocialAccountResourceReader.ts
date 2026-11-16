import type { ExtensionStoragePort } from "../../types/BrowserPorts";
import type { SocialAccount } from "../../types/types";
import type { AccountSource, SocialAccountState } from "../../types/SocialAccountContracts";
import { SocialAccountClient, SocialAccountClientError } from "./SocialAccountClient";

function sameSource(left: AccountSource | undefined, right: AccountSource): boolean {
  if (!left || left.userId !== right.userId || left.sessionId !== right.sessionId) return false;
  return left.type === "persona" && right.type === "persona" ? left.personaId === right.personaId :
    left.type === "extension_config" && right.type === "extension_config" && left.extensionConfigId === right.extensionConfigId;
}
function changed(): never {
  throw new SocialAccountClientError("ACCOUNT_SOURCE_CHANGED", "Account source or catalog changed");
}

/** Temporary credential-bearing reader, removed when R4 owns resource execution.
 * Never reads the unscoped compatibility arrays and never writes storage.
 */
export class SocialAccountResourceReader {
  constructor(private readonly client: SocialAccountClient, private readonly storage: ExtensionStoragePort) {}

  async read(refresh = false): Promise<SocialAccount[]> {
    let state = refresh ? await this.client.refresh() : await this.client.getState();
    if (state.status === "uninitialized") state = await this.client.refresh();
    return this.readMatchingCatalog(state);
  }

  private async readMatchingCatalog(state: SocialAccountState): Promise<SocialAccount[]> {
    const { socialAccountCatalog: catalog } = await this.storage.get(["socialAccountCatalog"]);
    if (!catalog || !sameSource(catalog.source, state.source) ||
        catalog.revision !== state.revision || catalog.refreshedAt !== state.refreshedAt ||
        !Array.isArray(catalog.accounts)) return changed();
    const accounts = catalog.accounts as SocialAccount[];
    if (accounts.length !== state.accounts.length || accounts.some((account, index) => {
      const expected = state.accounts[index];
      return !account || account.account_id !== expected.accountId || account.platform !== expected.platform ||
        account.status !== expected.status || Boolean(account.cookies) !== expected.hasCookies ||
        Boolean(account.proxy && Object.keys(account.proxy).length) !== expected.hasProxy;
    })) return changed();
    const latest = await this.client.getState();
    if (latest.status !== "cached" || !sameSource(latest.source, state.source) ||
        latest.revision !== state.revision || latest.refreshedAt !== state.refreshedAt) return changed();
    return accounts;
  }
}
