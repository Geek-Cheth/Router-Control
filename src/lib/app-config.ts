import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import {
  applyDialogEnvToProfile,
  DEFAULT_PROFILES,
  getActiveProfile,
  migrateLegacyConfig,
  type ProfilesConfig,
  type RouterProfile,
} from "./profiles";

export type { ProfilesConfig, RouterProfile } from "./profiles";

let applied = false;
let cachedConfig: ProfilesConfig | null = null;

export function getAppDataDir(): string {
  if (process.env.APP_DATA_DIR) return process.env.APP_DATA_DIR;
  return join(homedir(), ".browser-control");
}

export function getConfigFilePath(): string {
  return join(getAppDataDir(), "config.json");
}

export function getDefaultDbPath(profileId?: string): string {
  const suffix = profileId ? `-${profileId}` : "";
  return join(getAppDataDir(), `router-control${suffix}.db`);
}

export function loadProfilesConfig(): ProfilesConfig {
  if (cachedConfig) return cachedConfig;

  const path = getConfigFilePath();
  if (!existsSync(path)) {
    cachedConfig = migrateLegacyConfig({});
    return cachedConfig;
  }

  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    cachedConfig = migrateLegacyConfig(raw);
    return cachedConfig;
  } catch {
    cachedConfig = migrateLegacyConfig({});
    return cachedConfig;
  }
}

export function saveProfilesConfig(config: ProfilesConfig): void {
  const dir = getAppDataDir();
  mkdirSync(dir, { recursive: true });
  writeFileSync(getConfigFilePath(), JSON.stringify(config, null, 2), "utf8");
  cachedConfig = config;
}

export function getProfileById(profileId: string): RouterProfile {
  const config = loadProfilesConfig();
  const profile = config.profiles.find((p) => p.id === profileId);
  if (!profile) {
    throw new Error(`Unknown router profile: ${profileId}`);
  }
  return applyDialogEnvToProfile(profile);
}

export function getActiveProfileConfig(): RouterProfile {
  return applyDialogEnvToProfile(getActiveProfile(loadProfilesConfig()));
}

export function listPublicProfiles() {
  return loadProfilesConfig().profiles.map((profile) => ({
    id: profile.id,
    name: profile.name,
    type: profile.type,
    host: (() => {
      try {
        return new URL(profile.routerUrl).host;
      } catch {
        return profile.routerUrl;
      }
    })(),
  }));
}

export function applyConfigToEnv(): void {
  if (applied) return;
  applied = true;

  const config = loadProfilesConfig();
  const active = getActiveProfile(config);
  const profile = applyDialogEnvToProfile(active);

  if (!process.env.ROUTER_URL) process.env.ROUTER_URL = profile.routerUrl;
  if (!process.env.ROUTER_USERNAME) process.env.ROUTER_USERNAME = profile.routerUsername;
  if (!process.env.ROUTER_PASSWORD && profile.routerPassword) {
    process.env.ROUTER_PASSWORD = profile.routerPassword;
  }
  if (!process.env.ACTIVE_PROFILE_ID) process.env.ACTIVE_PROFILE_ID = active.id;
  if (!process.env.DB_PATH && process.env.APP_DATA_DIR) {
    process.env.DB_PATH = getDefaultDbPath(active.id);
  }
}

export function updateRouterPasswordInConfig(profileId: string, newPassword: string): void {
  const config = loadProfilesConfig();
  const profile = config.profiles.find((p) => p.id === profileId);
  if (!profile) throw new Error(`Unknown router profile: ${profileId}`);
  profile.routerPassword = newPassword;
  saveProfilesConfig(config);
  if (profileId === "dialog") {
    process.env.ROUTER_PASSWORD = newPassword;
  }
}

export function loadAppConfig() {
  const profile = getActiveProfileConfig();
  return {
    routerUrl: profile.routerUrl,
    routerUsername: profile.routerUsername,
    routerPassword: profile.routerPassword,
  };
}

export function saveAppConfig(config: {
  routerUrl: string;
  routerUsername: string;
  routerPassword: string;
}): void {
  const profilesConfig = loadProfilesConfig();
  const dialog = profilesConfig.profiles.find((p) => p.id === "dialog") ?? DEFAULT_PROFILES[0];
  Object.assign(dialog, config);
  saveProfilesConfig(profilesConfig);
}
