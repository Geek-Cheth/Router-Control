import { app } from "electron";
import { homedir } from "os";
import { join } from "path";

export function getUserDataDir(): string {
  try {
    return app.getPath("userData");
  } catch {
    return join(homedir(), ".browser-control");
  }
}

export function getConfigPath(): string {
  return join(getUserDataDir(), "config.json");
}

export function getDbPath(): string {
  return join(getUserDataDir(), "router-control.db");
}

export function getStandaloneDir(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, "standalone");
  }
  return join(process.cwd(), ".next", "standalone");
}

export function getServerEntry(): string {
  return join(getStandaloneDir(), "server.js");
}

export function getIconPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, "icon.png");
  }
  return join(process.cwd(), "resources", "icon.png");
}
