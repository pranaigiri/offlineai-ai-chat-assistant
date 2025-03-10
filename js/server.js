import express from "express";
import { spawn, execSync } from "child_process";
import ollama from "ollama";
import fs from "fs";
import net from "net";

const MAX_HISTORY_LENGTH = 20;

const app = express();
app.use(express.json());

const config = JSON.parse(fs.readFileSync("config/config.json", "utf-8"));
let MODEL_NAME = config.DEFAULT_MODEL.value;
let downloadProgress = 0;

const isOllamaInstalled = () => {
  try {
    execSync("ollama --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

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

app.get("/download-progress", async (req, res) => {
  const modelName = req.query.model || MODEL_NAME;
  try {
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

const ensureModel = async (model) => {
  try {
    const models = await ollama.list();
    if (models.models.some((m) => m.name === model)) return;

    const pullProcess = spawn("ollama", ["pull", model]);

    pullProcess.stdout.on("data", (data) => {
      const output = data.toString();
      console.log(output); // Log the output for debugging
      const match = output.match(/(\d+)%/);
      if (match) {
        downloadProgress = parseInt(match[1]);
        console.log(`Download progress: ${downloadProgress}%`);
      }
    });

    pullProcess.stderr.on("data", (data) => {
      console.error(`ollama pull stderr: ${data}`);
    });

    pullProcess.on("error", (error) => {
      console.error("Failed to start ollama pull:", error);
    });

    pullProcess.on("close", (code) => {
      if (code === 0) {
        downloadProgress = 100;
        console.log("Model download complete.");
      } else {
        console.error(`ollama pull exited with code ${code}`);
      }
    });
  } catch (error) {
    console.error("Error ensuring model:", error);
  }
};

const initOllama = async () => {
  if (!isOllamaInstalled()) installOllama();
  await ensureModel(MODEL_NAME);
};

app.get("/active-model", async (req, res) => {
  try {
    const models = await ollama.list();
    res.json({
      model: MODEL_NAME,
      modelExists: models.models.some((m) => m.name === MODEL_NAME),
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch model list" });
  }
});

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
  } catch {
    res.status(500).json({ error: "Failed to change model" });
  }
});

app.post("/chat", async (req, res) => {
  const { sessionId, messages } = req.body;

  if (!sessionId || !Array.isArray(messages)) {
    return res
      .status(400)
      .json({ error: "sessionId and messages are required" });
  }

  try {
    // Set response headers for streaming
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Transfer-Encoding", "chunked");

    // Send entire conversation history to Ollama
    const responseStream = await ollama.chat({
      model: MODEL_NAME,
      messages,
      stream: true,
    });

    let fullResponse = "";
    for await (const chunk of responseStream) {
      const content = chunk.message?.content || "";
      res.write(content);
      fullResponse += content;
    }

    res.end();
  } catch (error) {
    console.error("Error processing AI chat:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

const PORT = process.env.PORT || 3000;
const server = net.createServer();

server.once("error", (err) => {
  if (err.code === "EADDRINUSE") {
    app.listen(0, function () {
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
  server.close(() => process.exit(0));
});
