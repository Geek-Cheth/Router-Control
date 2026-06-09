import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

export interface AppConfig {
  routerUrl: string;
  routerUsername: string;
  routerPassword: string;
}

const DEFAULTS: AppConfig = {
  routerUrl: "http://192.168.8.1",
  routerUsername: "user",
  routerPassword: "",
};

let applied = false;

export function getAppDataDir(): string {
  if (process.env.APP_DATA_DIR) return process.env.APP_DATA_DIR;
  return join(homedir(), ".browser-control");
}

export function getConfigFilePath(): string {
  return join(getAppDataDir(), "config.json");
}

export function getDefaultDbPath(): string {
  return join(getAppDataDir(), "router-control.db");
}

export function loadAppConfig(): AppConfig {
  const path = getConfigFilePath();
  if (!existsSync(path)) return { ...DEFAULTS };
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<AppConfig>;
    return {
      routerUrl: raw.routerUrl ?? DEFAULTS.routerUrl,
      routerUsername: raw.routerUsername ?? DEFAULTS.routerUsername,
      routerPassword: raw.routerPassword ?? DEFAULTS.routerPassword,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveAppConfig(config: AppConfig): void {
  const dir = getAppDataDir();
  mkdirSync(dir, { recursive: true });
  writeFileSync(getConfigFilePath(), JSON.stringify(config, null, 2), "utf8");
}

export function applyConfigToEnv(): void {
  if (applied) return;
  applied = true;

  const config = loadAppConfig();
  if (!process.env.ROUTER_URL) process.env.ROUTER_URL = config.routerUrl;
  if (!process.env.ROUTER_USERNAME) process.env.ROUTER_USERNAME = config.routerUsername;
  if (!process.env.ROUTER_PASSWORD && config.routerPassword) {
    process.env.ROUTER_PASSWORD = config.routerPassword;
  }
  if (!process.env.DB_PATH && process.env.APP_DATA_DIR) {
    process.env.DB_PATH = getDefaultDbPath();
  }
}

export function updateRouterPasswordInConfig(newPassword: string): void {
  const config = loadAppConfig();
  config.routerPassword = newPassword;
  saveAppConfig(config);
  process.env.ROUTER_PASSWORD = newPassword;
}
