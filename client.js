const input = document.getElementById("message");
input.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    event.preventDefault(); // Prevent newline in input
    sendMessage();
  }
});

const statusBar = document.getElementById("status-bar");
const toast = document.getElementById("toast");

// Function to show status bar
function showStatus(message) {
  statusBar.innerText = message;
  statusBar.style.display = "block";
}

// Function to hide status bar
function hideStatus() {
  statusBar.style.display = "none";
}

// Function to show toast notification
function showToast(message, type = "success") {
  toast.innerText = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => {
    toast.className = "toast";
  }, 3000);
}

fetch("./config.json")
  .then((response) => response.json())
  .then((data) => {
    const modelSelect = document.getElementById("selected-model");

    // Populate dropdown with models
    data.ALL_AVAILABLE_MODELS.forEach((model) => {
      const option = document.createElement("option");
      option.value = model.value;
      option.textContent = model.label;
      modelSelect.appendChild(option);
    });

    // Fetch current active model from server
    showStatus("Fetching active model...");
    fetch("http://localhost:3000/active-model")
      .then((response) => response.json())
      .then((serverData) => {
        hideStatus();
        if (serverData.modelExists) {
          modelSelect.value = serverData.model;
          const modelEntry = data.ALL_AVAILABLE_MODELS.find(
            (m) => m.value === serverData.model
          );
          showToast(`Active model: ${modelEntry.label}`);
        } else {
          const defaultModel = data.DEFAULT_MODEL;
          modelSelect.value = defaultModel.value;
          this.checkDownloadProgress(defaultModel.value);
        }
      })
      .catch((error) => {
        hideStatus();
        showToast("Failed to load active model", "error");
        console.error("Error fetching active model:", error);
      });

    // Handle model change event
    // Listen for Model Change
    modelSelect.addEventListener("change", (event) => {
      const selectedModel = event.target.value;
      console.log("Changing model to:", selectedModel);
      showStatus(`Checking model: ${selectedModel}...`);

      fetch("http://localhost:3000/change-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: selectedModel }),
      })
        .then((response) => response.json())
        .then((result) => {
          hideStatus();
          if (result.error) {
            console.error("Error:", result.error);
            showToast("Failed to change model", "error");
          } else {
            showToast(`Model changed to ${result.activeModel}`);
          }
        })
        .catch((error) => {
          console.error("Error changing model:", error);
          showToast("Error changing model", "error");
        });

      checkDownloadProgress(selectedModel, data.ALL_AVAILABLE_MODELS);
    });
  })
  .catch((error) => {
    console.error("Error loading models:", error);
    showToast("Error loading models", "error");
  });

// Poll for Download Progress
function checkDownloadProgress(selectedModel, availableModelList) {
  const progressContainer = document.getElementById("progress-container");
  const progressBar = document.getElementById("progress-bar");
  const inputArea = document.getElementById("input-area");
  const modelDropdown = document.getElementById("model-dropdown");
  const chatContainer = document.getElementById("chat-container");

  let dots = 0;

  const createInfoCard = () => {
    const infoCard = document.createElement("div");
    infoCard.classList.add("info-card");
    const modelEntry = availableModelList?.find(
      (m) => m.value === selectedModel
    );
    infoCard.innerHTML = `You can now have a conversation with <span>PranAI - ${
      modelEntry?.label?.split(" (")[0] ?? selectedModel ?? "AI Assist"
    }</span>`;
    chatContainer.appendChild(infoCard);
  };

  const updateProgressBar = (progress) => {
    dots = (dots + 1) % 4;
    progressBar.innerText = `Downloading model${".".repeat(dots)}`;

    // Show progress bar
    progressContainer.style.transition = "height 0.5s ease, opacity 0.5s ease";
    progressContainer.style.height = "30px";
    progressContainer.style.opacity = "1";

    // Disable inputs during download
    inputArea.classList.add("disabled");
    modelDropdown.classList.add("disabled");
  };

  const completeDownload = () => {
    clearInterval(interval);
    progressContainer.style.backgroundColor = "#42b12e";
    progressBar.innerText = "Download Complete!";

    // Re-enable inputs
    inputArea.classList.remove("disabled");
    modelDropdown.classList.remove("disabled");

    // Hide progress bar smoothly
    setTimeout(() => {
      progressContainer.style.height = "0px";
      progressContainer.style.opacity = "0";
    }, 2000);

    createInfoCard();
  };

  const interval = setInterval(async () => {
    try {
      const response = await fetch(
        `http://localhost:3000/download-progress?model=${encodeURIComponent(
          selectedModel
        )}`
      );
      if (!response.ok) throw new Error("Failed to fetch progress");

      const res = await response.json();

      if (res.progress >= 100 && res.modelExists) {
        completeDownload();
      } else if (res.progress > 0 || !res.modelExists) {
        updateProgressBar(res.progress);
      } else {
        clearInterval(interval);
        progressContainer.style.height = "0px";
        progressContainer.style.opacity = "0";
        inputArea.classList.remove("disabled");
        modelDropdown.classList.remove("disabled");
        createInfoCard();
      }
    } catch (error) {
      console.error("Error checking download progress:", error);
      clearInterval(interval);
    }
  }, 1000);
}

// Send Message with Typing Animation
async function sendMessage() {
  const chatContainer = document.getElementById("chat-container");
  const input = document.getElementById("message");

  const message = input.value.trim(); // Store message before clearing input

  if (!message) return;

  appendMessage(message, "user-message");
  input.value = ""; // Clear input after storing message

  // Show Typing Animation
  const typingIndicator = appendMessage(
    "PranAI is typing",
    "ai-message typing-indicator"
  );
  let dots = 0;
  const typingAnimation = setInterval(() => {
    dots = (dots + 1) % 4;
    typingIndicator.innerText = "PranAI is typing" + ".".repeat(dots);
  }, 500);

  try {
    const response = await fetch("http://localhost:3000/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: message }), // Use stored message
    });

    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

    const data = await response.json();

    clearInterval(typingAnimation);
    typingIndicator.remove();

    appendMessage(data.response, "ai-message");
  } catch (error) {
    console.error("Error fetching AI response:", error);
    clearInterval(typingAnimation);
    typingIndicator.remove();
    appendMessage(
      "Error fetching response. Please try again.",
      "ai-message error"
    );
  }
}

// Helper function to append messages
function appendMessage(text, className) {
  const chatContainer = document.getElementById("chat-container");
  const message = document.createElement("div");
  message.className = `message ${className}`;
  message.innerText = text;
  chatContainer.appendChild(message);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  return message;
}
