import {
  getStandaloneDir,
  getServerEntry,
  getUserDataDir,
} from "./paths";
import { spawn, type ChildProcess } from "child_process";
import { createServer } from "net";
import { createWriteStream } from "fs";
import { join } from "path";

export async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not resolve free port"));
        return;
      }
      const { port } = address;
      server.close(() => resolve(port));
    });
  });
}

export function startNextServer(
  port: number,
  env: Record<string, string>
): ChildProcess {
  const standaloneDir = getStandaloneDir();
  const serverEntry = getServerEntry();

  const childEnv = {
    ...process.env,
    ...env,
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
    NODE_ENV: "production",
    ELECTRON_RUN_AS_NODE: "1",
  };

  const child = spawn(process.execPath, [serverEntry], {
    cwd: standaloneDir,
    env: childEnv as NodeJS.ProcessEnv,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  const logPath = join(getUserDataDir(), "server.log");
  const logStream = createWriteStream(logPath, { flags: "a" });
  logStream.write(`\n--- server start ${new Date().toISOString()} ---\n`);

  child.stdout?.pipe(logStream, { end: false });
  child.stderr?.pipe(logStream, { end: false });

  child.on("exit", (code, signal) => {
    logStream.write(`\n--- server exit code=${code} signal=${signal} ---\n`);
    logStream.end();
  });

  return child;
}

export function stopServer(child: ChildProcess | null): void {
  if (!child || child.killed) return;
  try {
    if (process.platform === "win32" && child.pid) {
      spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
    } else {
      child.kill("SIGTERM");
    }
  } catch {
    child.kill("SIGKILL");
  }
}

export async function waitForServer(url: string, timeoutMs = 30000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.ok || res.status < 500) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`);
}
