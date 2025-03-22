const {
  app,
  BrowserWindow,
  screen,
  dialog,
  shell,
  ipcMain,
} = require("electron");
const { spawn, execSync } = require("child_process");
const path = require("path");
const { getServerPort } = require("./server.js");

// CommonJS already provides __filename and __dirname, no need to redefine them

let mainWindow;
let tray;
let serverProcess;

// Get the correct path for `config.json`
const fs = require("fs");
// Dynamically get the correct config file path
const getConfigPath = () => {
  return app.isPackaged
    ? path.join(process.resourcesPath, "config/config.json") // For built `.exe`
    : path.join(__dirname, "..", "config/config.json"); // For development (`npm start`)
};

// Read config file
const configPath = getConfigPath();

if (!fs.existsSync(configPath)) {
  console.error("Config file not found at:", configPath);
} else {
  const configData = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  console.log("Config loaded successfully", configData);
}

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
    icon: path.join(__dirname, "../assets/logo/OfflineAI.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      enableRemoteModule: false,
      nodeIntegration: true,
    },
  });

  ipcMain.handle("get-server-port", async () => {
    return getServerPort(); // Return the server port (async)
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
