import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { resetRouterClient } from "@/lib/router-client";
import {
  loadAppConfig,
  saveAppConfig,
  updateRouterPasswordInConfig,
} from "@/lib/app-config";

export function updateEnvPassword(newPassword: string): void {
  updateRouterPasswordInConfig(newPassword);

  const envPath = join(process.cwd(), ".env.local");
  let content = "";
  try {
    content = readFileSync(envPath, "utf8");
  } catch {
    // Dev-only fallback; packaged app uses config.json
    saveAppConfig({ ...loadAppConfig(), routerPassword: newPassword });
    resetRouterClient();
    return;
  }
  if (/ROUTER_PASSWORD=/m.test(content)) {
    content = content.replace(/ROUTER_PASSWORD=.*/m, `ROUTER_PASSWORD=${newPassword}`);
  } else {
    content += `\nROUTER_PASSWORD=${newPassword}\n`;
  }
  writeFileSync(envPath, content, "utf8");
  process.env.ROUTER_PASSWORD = newPassword;
  resetRouterClient();
}
