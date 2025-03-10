import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  sendMessage: (message) => ipcRenderer.invoke("sendMessage", message),
});
