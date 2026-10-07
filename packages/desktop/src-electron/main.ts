import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "path";
import {
  activate,
  generateLocal,
  heartbeat,
  licenseSnapshot,
} from "./license-client";

let mainWindow: BrowserWindow | null = null;
let heartbeatTimer: NodeJS.Timeout | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    title: "ReelStorm Studio",
    backgroundColor: "#080808",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const ui = path.join(__dirname, "../dist/index.html");
  void mainWindow.loadFile(ui).catch(() => {
    void mainWindow?.loadURL(
      "data:text/html," +
        encodeURIComponent(
          `<html><body style="font-family:sans-serif;background:#080808;color:#fff;padding:40px">
          <h1>ReelStorm Studio</h1>
          <p>UI build missing — run <code>npm run build:ui</code> in packages/desktop.</p>
          <p>License IPC is live. Activate via DevTools if needed.</p>
          </body></html>`,
        ),
    );
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });
}

function startHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  const tick = async () => {
    try {
      if (licenseSnapshot().activated) await heartbeat();
    } catch {
      /* UI will surface on next action */
    }
  };
  void tick();
  heartbeatTimer = setInterval(() => void tick(), 3600_000);
}

app.whenReady().then(() => {
  createWindow();
  startHeartbeat();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("license:snapshot", () => licenseSnapshot());
ipcMain.handle("license:activate", async (_e, email: string, key: string) => activate(email, key));
ipcMain.handle("license:heartbeat", async () => heartbeat());
ipcMain.handle("studio:generate", async (_e, prompt: string, durationSec: number) =>
  generateLocal(prompt, durationSec),
);
ipcMain.handle("studio:open-dashboard", async () => {
  await shell.openExternal("https://app.reelstorm.uk/settings/studio");
});
