import { app, BrowserWindow, screen, dialog, shell } from "electron";
import { spawn, execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let tray;
let serverProcess;

const isOllamaInstalled = () => {
  try {
    execSync("ollama --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

app.whenReady().then(async () => {
  if (!isOllamaInstalled()) {
    dialog.showErrorBox(
      "Ollama Required",
      "Ollama is required to run this app. Please install Ollama from https://ollama.com/download"
    );
    shell.openExternal("https://ollama.com/download"); //Open download link in browser
    app.quit();
    return; // Prevent app from starting if Ollama is not installed
  }

  // Start the API server using spawn instead of exec
  serverProcess = spawn("node", ["js/server.js"], {
    stdio: "inherit",
    detached: false,
  });

  serverProcess.on("error", (err) => {
    console.error(`Error starting API: ${err.message}`);
  });

  serverProcess.on("exit", (code) => {
    console.log(`API server exited with code: ${code}`);
  });

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize; // Get usable screen size

  mainWindow = new BrowserWindow({
    width: Math.min(500, width / 3), // Set width to 1/3rd of the screen or 400px max
    height: height, // Full screen height
    x: width - Math.min(500, width / 3), // Position at right edge of screen
    y: 0, // Start from top
    alwaysOnTop: false, // Set true if you want it to stay above other windows
    minimizable: true,
    resizable: true,
    icon: path.join(__dirname, "../assets/logo/PranAI.ico"),
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
