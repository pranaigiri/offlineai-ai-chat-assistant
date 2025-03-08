import express from "express";
import { exec, spawn } from "child_process";
import ollama from "ollama";
import fs from "fs";
import net from "net";

const app = express();
app.use(express.json());

// Load config.json
const config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));
let MODEL_NAME = config.DEFAULT_MODEL.value;
let downloadProgress = 0;
console.log("MODEL_NAME:", MODEL_NAME);

// Function to check if Ollama is installed
function isOllamaInstalled() {
  try {
    execSync("ollama --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// Install Ollama if missing
function installOllama() {
  console.log("Ollama not found. Installing...");
  if (process.platform === "win32") {
    console.log(
      "Please manually download Ollama from https://ollama.com/download"
    );
  } else {
    execSync("curl -fsSL https://ollama.ai/install.sh | sh", {
      stdio: "inherit",
    });
  }
}

// New API to Fetch Model Download Progress
app.get("/download-progress", async (req, res) => {
  const { model } = req.query; // Get model name from the request query
  const modelName = model || MODEL_NAME; // Use provided model or default one

  try {
    const models = await ollama.list();
    const modelExists = models.models.some((m) => m.name === modelName);

    res.json({
      progress: downloadProgress,
      model: modelName,
      modelExists,
    });
  } catch (error) {
    console.error("Error fetching model list:", error.message);
    res.status(500).json({ error: "Failed to fetch model list" });
  }
});

async function ensureModel(model) {
  try {
    const models = await ollama.list();
    if (models.models.some((m) => m.name === model)) {
      console.log("Model already exists.");
      return;
    }

    console.log(`Downloading model: ${model}...`);
    const pullProcess = spawn("ollama", ["pull", model]);

    pullProcess.stdout.on("data", (data) => {
      const output = data.toString();
      console.log("OUTPUT:", output);

      // Extract progress percentage (example: "Downloading... 35%")
      const match = output.match(/(\d+)%/);
      if (match) {
        downloadProgress = parseInt(match[1]);
      }
    });

    pullProcess.stderr.on("data", (data) => {
      console.error("Error:", data.toString());
    });

    pullProcess.on("close", (code) => {
      console.log(`Model download finished with code: ${code}`);
      downloadProgress = 100; // Mark as complete
    });
  } catch (error) {
    console.error("Error ensuring model:", error.message);
  }
}

// Initialize Ollama setup
async function initOllama() {
  if (!isOllamaInstalled()) installOllama();
  await ensureModel(MODEL_NAME);
}

// Endpoint to Get Active Model
app.get("/active-model", async (req, res) => {
  try {
    const models = await ollama.list();
    const modelExists = models.models.some((m) => m.name === MODEL_NAME);
    res.json({
      model: MODEL_NAME,
      modelExists,
    });
  } catch (error) {
    console.error("Error fetching model list:", error.message);
    res.status(500).json({ error: "Failed to fetch model list" });
  }
});

// Endpoint to Change Model
app.post("/change-model", async (req, res) => {
  const { model } = req.body;

  if (!model) {
    return res.status(400).json({ error: "Model name is required" });
  }

  try {
    console.log(`Changing model to: ${model}...`);
    await ensureModel(model);
    MODEL_NAME = model;
    res.json({
      message: `Model changed to ${MODEL_NAME}`,
      activeModel: MODEL_NAME,
    });
  } catch (error) {
    console.error("Error changing model:", error.message);
    res.status(500).json({ error: "Failed to change model" });
  }
});

// Chat API Route
app.post("/chat", async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  try {
    const response = await ollama.chat({
      model: MODEL_NAME, // Ensure model is passed as an object key
      messages: [{ role: "user", content: message }],
    });

    res.json({ response: response.message?.content || "No response" });
  } catch (error) {
    console.error("Error processing AI chat:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Start Server
const PORT = process.env.PORT || 3000;

const server = net.createServer();

server.once("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.log(`Port ${PORT} is already in use. Trying a new port...`);
    app.listen(0, async function () {
      console.log(`Server running on port ${this.address().port}`);
    });
  }
});

server.once("listening", () => {
  server.close();
  app.listen(PORT, async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    await initOllama();
  });
});

server.listen(PORT);

process.on("SIGINT", () => {
  console.log("Shutting down server...");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
