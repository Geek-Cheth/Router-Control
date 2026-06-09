import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  nativeImage,
  shell,
  dialog,
} from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import {
  getConfigPath,
  getDbPath,
  getIconPath,
  getUserDataDir,
} from "./paths";
import {
  findFreePort,
  startNextServer,
  stopServer,
  waitForServer,
} from "./server-manager";
import type { ChildProcess } from "child_process";

interface StoredConfig {
  routerUrl: string;
  routerUsername: string;
  routerPassword: string;
}

const DEFAULT_CONFIG: StoredConfig = {
  routerUrl: "http://192.168.8.1",
  routerUsername: "user",
  routerPassword: "",
};

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let serverProcess: ChildProcess | null = null;
let appUrl = "http://127.0.0.1:3000";

function parseEnvLocal(): Partial<StoredConfig> | null {
  const candidates = [
    join(process.cwd(), ".env.local"),
    join(process.cwd(), "..", ".env.local"),
  ];
  for (const envPath of candidates) {
    if (!existsSync(envPath)) continue;
    try {
      const content = readFileSync(envPath, "utf8");
      const out: Partial<StoredConfig> = {};
      for (const line of content.split("\n")) {
        const m = line.match(/^(ROUTER_URL|ROUTER_USERNAME|ROUTER_PASSWORD)=(.*)$/);
        if (!m) continue;
        const val = m[2].trim();
        if (m[1] === "ROUTER_URL") out.routerUrl = val;
        if (m[1] === "ROUTER_USERNAME") out.routerUsername = val;
        if (m[1] === "ROUTER_PASSWORD") out.routerPassword = val;
      }
      if (out.routerPassword || out.routerUrl) return out;
    } catch {
      // try next
    }
  }
  return null;
}

function loadOrCreateConfig(): StoredConfig {
  const userData = getUserDataDir();
  mkdirSync(userData, { recursive: true });

  const configPath = getConfigPath();
  if (!existsSync(configPath)) {
    const fromEnv = parseEnvLocal();
    const initial = { ...DEFAULT_CONFIG, ...fromEnv };
    writeFileSync(configPath, JSON.stringify(initial, null, 2), "utf8");
    return initial;
  }

  try {
    const raw = JSON.parse(readFileSync(configPath, "utf8")) as Partial<StoredConfig>;
    return {
      routerUrl: raw.routerUrl ?? DEFAULT_CONFIG.routerUrl,
      routerUsername: raw.routerUsername ?? DEFAULT_CONFIG.routerUsername,
      routerPassword: raw.routerPassword ?? DEFAULT_CONFIG.routerPassword,
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function createWindow() {
  const iconPath = getIconPath();
  const icon = existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : undefined;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "Router Control",
    icon,
    show: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.loadURL(appUrl);

  mainWindow.webContents.on("did-fail-load", (_event, code, description) => {
    dialog.showErrorBox(
      "Failed to load dashboard",
      `${description} (${code})\n\nURL: ${appUrl}`
    );
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("close", (event) => {
    if (tray && !isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createTray() {
  const iconPath = getIconPath();
  if (!existsSync(iconPath)) return;

  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip("Router Control");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show Dashboard",
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on("double-click", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

async function bootstrap() {
  const config = loadOrCreateConfig();
  const isDev = process.env.ELECTRON_DEV === "1";

  if (isDev) {
    appUrl = "http://127.0.0.1:3000";
  } else {
    const port = await findFreePort();
    appUrl = `http://127.0.0.1:${port}`;

    serverProcess = startNextServer(port, {
      APP_DATA_DIR: getUserDataDir(),
      DB_PATH: getDbPath(),
      ROUTER_URL: config.routerUrl,
      ROUTER_USERNAME: config.routerUsername,
      ROUTER_PASSWORD: config.routerPassword,
    });

    await waitForServer(appUrl);
  }

  createWindow();
  createTray();
}

let isQuitting = false;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(bootstrap).catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Failed to start:", err);
    dialog.showErrorBox(
      "Router Control failed to start",
      `${message}\n\nCheck ${join(getUserDataDir(), "server.log")} for details.`
    );
    app.quit();
  });

  app.on("before-quit", () => {
    isQuitting = true;
    stopServer(serverProcess);
    serverProcess = null;
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else mainWindow?.show();
  });
}
