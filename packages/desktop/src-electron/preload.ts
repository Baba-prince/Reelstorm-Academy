import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("reelstormStudio", {
  snapshot: () => ipcRenderer.invoke("license:snapshot"),
  activate: (email: string, key: string) => ipcRenderer.invoke("license:activate", email, key),
  heartbeat: () => ipcRenderer.invoke("license:heartbeat"),
  generate: (prompt: string, durationSec: number) =>
    ipcRenderer.invoke("studio:generate", prompt, durationSec),
  openDashboard: () => ipcRenderer.invoke("studio:open-dashboard"),
});
