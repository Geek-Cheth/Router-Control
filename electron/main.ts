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



type RouterProfileType = "dialog" | "huawei";



interface RouterProfile {

  id: string;

  name: string;

  type: RouterProfileType;

  routerUrl: string;

  routerUsername: string;

  routerPassword: string;

}



interface ProfilesConfig {

  activeProfileId: string;

  profiles: RouterProfile[];

}



const DEFAULT_PROFILES: RouterProfile[] = [

  {

    id: "dialog",

    name: "Dialog CPE",

    type: "dialog",

    routerUrl: "http://192.168.8.1",

    routerUsername: "user",

    routerPassword: "",

  },

  {

    id: "b310",

    name: "B310",

    type: "huawei",

    routerUrl: "http://192.168.8.1",

    routerUsername: "user",

    routerPassword: "yi5hfGe1",

  },

];



let mainWindow: BrowserWindow | null = null;

let tray: Tray | null = null;

let serverProcess: ChildProcess | null = null;

let appUrl = "http://127.0.0.1:3000";



function parseEnvLocal(): Partial<RouterProfile> | null {

  const candidates = [

    join(process.cwd(), ".env.local"),

    join(process.cwd(), "..", ".env.local"),

  ];

  for (const envPath of candidates) {

    if (!existsSync(envPath)) continue;

    try {

      const content = readFileSync(envPath, "utf8");

      const out: Partial<RouterProfile> = {};

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



function migrateLegacyConfig(raw: Record<string, unknown>): ProfilesConfig {

  if (Array.isArray(raw.profiles) && raw.profiles.length > 0) {

    const profiles = (raw.profiles as RouterProfile[]).map((profile) => ({

      id: profile.id ?? "dialog",

      name: profile.name ?? profile.id ?? "Router",

      type: (profile.type === "huawei" ? "huawei" : "dialog") as RouterProfileType,

      routerUrl: profile.routerUrl ?? "http://192.168.8.1",

      routerUsername: profile.routerUsername ?? "user",

      routerPassword: profile.routerPassword ?? "",

    }));

    const activeProfileId =

      typeof raw.activeProfileId === "string" &&

      profiles.some((profile) => profile.id === raw.activeProfileId)

        ? raw.activeProfileId

        : profiles[0].id;

    return { activeProfileId, profiles };

  }



  const legacyPassword =

    typeof raw.routerPassword === "string" ? raw.routerPassword : "";

  const legacyUrl =

    typeof raw.routerUrl === "string" ? raw.routerUrl : "http://192.168.8.1";

  const legacyUser =

    typeof raw.routerUsername === "string" ? raw.routerUsername : "user";



  const profiles = DEFAULT_PROFILES.map((profile) =>

    profile.id === "dialog"

      ? {

          ...profile,

          routerUrl: legacyUrl,

          routerUsername: legacyUser,

          routerPassword: legacyPassword || profile.routerPassword,

        }

      : profile

  );



  return {

    activeProfileId:

      typeof raw.activeProfileId === "string" ? raw.activeProfileId : "dialog",

    profiles,

  };

}



function loadOrCreateConfig(): ProfilesConfig {

  const userData = getUserDataDir();

  mkdirSync(userData, { recursive: true });



  const configPath = getConfigPath();

  if (!existsSync(configPath)) {

    const fromEnv = parseEnvLocal();

    const profiles = DEFAULT_PROFILES.map((profile) =>

      profile.id === "dialog" ? { ...profile, ...fromEnv } : profile

    );

    const initial: ProfilesConfig = {

      activeProfileId: "dialog",

      profiles,

    };

    writeFileSync(configPath, JSON.stringify(initial, null, 2), "utf8");

    return initial;

  }



  try {

    const raw = JSON.parse(readFileSync(configPath, "utf8")) as Record<string, unknown>;

    const migrated = migrateLegacyConfig(raw);

    writeFileSync(configPath, JSON.stringify(migrated, null, 2), "utf8");

    return migrated;

  } catch {

    const fallback: ProfilesConfig = {

      activeProfileId: "dialog",

      profiles: DEFAULT_PROFILES,

    };

    writeFileSync(configPath, JSON.stringify(fallback, null, 2), "utf8");

    return fallback;

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

  loadOrCreateConfig();

  const isDev = process.env.ELECTRON_DEV === "1";



  if (isDev) {

    appUrl = "http://127.0.0.1:3000";

  } else {

    const port = await findFreePort();

    appUrl = `http://127.0.0.1:${port}`;



    serverProcess = startNextServer(port, {

      APP_DATA_DIR: getUserDataDir(),

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


