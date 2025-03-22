const express = require("express");
const { spawn, execSync } = require("child_process");
const fs = require("fs");
const net = require("net");

const app = express();
app.use(express.json());

const config = JSON.parse(fs.readFileSync("config/config.json", "utf-8"));
let MODEL_NAME = config.DEFAULT_MODEL.value;
let downloadProgress = 0;

// ✅ Check if Ollama is installed
const isOllamaInstalled = () => {
  try {
    execSync("ollama --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

// ✅ Install Ollama if missing
const installOllama = () => {
  if (process.platform === "win32") {
    console.log(
      "Please manually download Ollama from https://ollama.com/download"
    );
  } else {
    execSync("curl -fsSL https://ollama.ai/install.sh | sh", {
      stdio: "inherit",
    });
  }
};

// ✅ Fetch download progress
app.get("/download-progress", async (req, res) => {
  const modelName = req.query.model || MODEL_NAME;
  try {
    const { default: ollama } = await import("ollama");
    const models = await ollama.list();
    const isModelExists = models.models.some((m) => m.name === modelName);

    res.json({
      progress: isModelExists ? 100 : downloadProgress || 0,
      model: modelName,
      modelExists: isModelExists,
    });
  } catch (error) {
    console.error("Error fetching model list:", error);
    res.status(500).json({ error: "Failed to fetch model list" });
  }
});

// ✅ Ensure model is downloaded
const ensureModel = async (model) => {
  try {
    const { default: ollama } = await import("ollama");
    const models = await ollama.list();
    if (models.models.some((m) => m.name === model)) return;

    console.log(`Model "${model}" not found. Downloading...`);

    return new Promise((resolve, reject) => {
      const pullProcess = spawn("ollama", ["pull", model]);

      pullProcess.stdout.on("data", (data) => {
        const output = data.toString();
        console.log(output);
        const match = output.match(/(\d+)%/);
        if (match) {
          downloadProgress = parseInt(match[1], 10);
          console.log(`Download progress: ${downloadProgress}%`);
        }
      });

      pullProcess.stderr.on("data", (data) => {
        console.error(`ollama pull stderr: ${data}`);
      });

      pullProcess.on("error", (error) => {
        console.error("Failed to start ollama pull:", error);
        reject(error);
      });

      pullProcess.on("close", (code) => {
        if (code === 0) {
          console.log("Model download complete.");
          resolve();
        } else {
          reject(new Error(`ollama pull exited with code ${code}`));
        }
      });
    });
  } catch (error) {
    console.error("Error ensuring model:", error);
  }
};

// ✅ Initialize Ollama
const initOllama = async () => {
  if (!isOllamaInstalled()) installOllama();
  await ensureModel(MODEL_NAME);
};

// ✅ Get active model
app.get("/active-model", async (req, res) => {
  try {
    const { default: ollama } = await import("ollama");
    const models = await ollama.list();
    res.json({
      model: MODEL_NAME,
      modelExists: models.models.some((m) => m.name === MODEL_NAME),
    });
  } catch (error) {
    console.error("Error fetching active model:", error);
    res.status(500).json({ error: "Failed to fetch model list" });
  }
});

// ✅ Change model
app.post("/change-model", async (req, res) => {
  if (!req.body.model)
    return res.status(400).json({ error: "Model name is required" });

  try {
    await ensureModel(req.body.model);
    MODEL_NAME = req.body.model;
    res.json({
      message: `Model changed to ${MODEL_NAME}`,
      activeModel: MODEL_NAME,
    });
  } catch (error) {
    console.error("Error changing model:", error);
    res.status(500).json({ error: "Failed to change model" });
  }
});

// ✅ Chat endpoint (streaming response)
app.post("/chat", async (req, res) => {
  const { sessionId, messages } = req.body;

  if (!sessionId || !Array.isArray(messages)) {
    return res
      .status(400)
      .json({ error: "sessionId and messages are required" });
  }

  try {
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Transfer-Encoding", "chunked");

    const { default: ollama } = await import("ollama");
    const responseStream = await ollama.chat({
      model: MODEL_NAME,
      messages,
      stream: true,
    });

    for await (const chunk of responseStream) {
      res.write(chunk.message?.content || "");
    }

    res.end();
  } catch (error) {
    console.error("Error processing AI chat:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

let serverPort;
const PORT = process.env.PORT || 3000;
const server = net.createServer();

// ✅ Handle address-in-use error
server.once("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.log(`Port ${PORT} in use. Trying another...`);
    app.listen(0, function () {
      serverPort = this.address().port;
      console.log(`Server running on port ${serverPort}`);
    });
  } else {
    console.error("Server error:", err);
  }
});

// ✅ Start server
server.once("listening", () => {
  server.close();
  app.listen(PORT, async () => {
    serverPort = PORT;
    console.log(`Server running on http://localhost:${serverPort}`);
    await initOllama(); // Initialize Ollama at startup
  });
});

server.listen(PORT);

// ✅ Graceful shutdown
process.on("SIGINT", () => {
  server.close(() => process.exit(0));
});

// ✅ Function to get server port
function getServerPort() {
  return serverPort;
}

module.exports = { getServerPort };
