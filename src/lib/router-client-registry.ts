import type { RouterProfile } from "./profiles";
import { DialogRouterClient } from "./dialog-router-client";
import { HuaweiRouterClient } from "./huawei-router-client";

export type RouterClient = DialogRouterClient | HuaweiRouterClient;

declare global {
  // eslint-disable-next-line no-var
  var __routerClients: Map<string, RouterClient> | undefined;
}

function getClientMap() {
  if (!global.__routerClients) {
    global.__routerClients = new Map();
  }
  return global.__routerClients;
}

export function getRouterClient(profile: RouterProfile): RouterClient {
  const map = getClientMap();
  const existing = map.get(profile.id);
  if (existing) return existing;

  const client =
    profile.type === "huawei"
      ? new HuaweiRouterClient(profile)
      : new DialogRouterClient(profile);

  map.set(profile.id, client);
  return client;
}

export function resetRouterClient(profileId?: string): void {
  const map = getClientMap();
  if (profileId) {
    map.delete(profileId);
    return;
  }
  map.clear();
}
