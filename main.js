import { app, BrowserWindow } from "electron";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let serverProcess;

app.whenReady().then(() => {
  // Start the API server using spawn instead of exec
  serverProcess = spawn("node", ["server.js"], {
    stdio: "inherit",
    detached: false,
  });

  serverProcess.on("error", (err) => {
    console.error(`Error starting API: ${err.message}`);
  });

  serverProcess.on("exit", (code) => {
    console.log(`API server exited with code: ${code}`);
  });

  // Create the Electron window
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile("index.html");

  // Handle window close properly
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
});

// Cleanup on close
app.on("window-all-closed", () => {
  if (serverProcess) {
    serverProcess.kill("SIGTERM"); // Ensure server process is killed
    console.log("API server process terminated.");
  }
  if (process.platform !== "darwin") app.quit();
});

// Ensure API server is closed when Electron quits
app.on("quit", () => {
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
    console.log("API server process terminated on quit.");
  }
});
