import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { resetRouterClient } from "@/lib/router-client";
import {
  loadProfilesConfig,
  saveProfilesConfig,
  updateRouterPasswordInConfig,
} from "@/lib/app-config";

export function updateEnvPassword(profileId: string, newPassword: string): void {
  updateRouterPasswordInConfig(profileId, newPassword);

  if (profileId !== "dialog") {
    resetRouterClient(profileId);
    return;
  }

  const envPath = join(process.cwd(), ".env.local");
  let content = "";
  try {
    content = readFileSync(envPath, "utf8");
  } catch {
    saveProfilesConfig(loadProfilesConfig());
    resetRouterClient(profileId);
    return;
  }
  if (/ROUTER_PASSWORD=/m.test(content)) {
    content = content.replace(/ROUTER_PASSWORD=.*/m, `ROUTER_PASSWORD=${newPassword}`);
  } else {
    content += `\nROUTER_PASSWORD=${newPassword}\n`;
  }
  writeFileSync(envPath, content, "utf8");
  process.env.ROUTER_PASSWORD = newPassword;
  resetRouterClient(profileId);
}
