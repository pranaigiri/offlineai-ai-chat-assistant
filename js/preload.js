const { contextBridge, ipcRenderer } = require("electron/renderer");
const path = require("path");

contextBridge.exposeInMainWorld("electronAPI", {
  setTitle: (title) => ipcRenderer.send("set-title", title),
  getServerPort: () => ipcRenderer.invoke("get-server-port"),
  getConfigPath: () => path.join(__dirname, "..", "config", "config.json"),
});
