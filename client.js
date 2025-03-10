document.addEventListener("DOMContentLoaded", () => {
  const uiContainer = document.querySelector(".ui-container");
  const menuToggle = document.getElementById("menu-toggle");
  const closeToggle = document.getElementById("close-toggle");
  const messageInput = document.getElementById("message");

  menuToggle.addEventListener("click", () => {
    uiContainer.classList.add("sidebar-open");
    menuToggle.classList.add("hidden");
    closeToggle.classList.remove("hidden");
  });

  closeToggle.addEventListener("click", () => {
    uiContainer.classList.remove("sidebar-open");
    closeToggle.classList.add("hidden");
    menuToggle.classList.remove("hidden");
  });

  messageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault(); // Prevent newline in input
      sendMessage();
    }
  });
});

const statusBar = document.getElementById("status-bar");
const toast = document.getElementById("toast");

const showStatus = (message) => {
  statusBar.innerText = message;
  statusBar.style.display = "block";
};

const hideStatus = () => (statusBar.style.display = "none");

const showToast = (message, type = "success") => {
  toast.innerText = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => (toast.className = "toast"), 3000);
};

fetch("./config.json")
  .then((res) => res.json())
  .then((data) => {
    const modelSelect = document.getElementById("selected-model");
    data.ALL_AVAILABLE_MODELS.forEach(({ value, label }) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      modelSelect.appendChild(option);
    });

    showStatus("Fetching active model...");
    fetch("http://localhost:3000/active-model")
      .then((res) => res.json())
      .then(({ modelExists, model }) => {
        hideStatus();
        if (modelExists) {
          modelSelect.value = model;
          showToast(
            `Active model: ${
              data.ALL_AVAILABLE_MODELS.find((m) => m.value === model)?.label
            }`
          );
        } else {
          modelSelect.value = data.DEFAULT_MODEL.value;
          checkDownloadProgress(
            data.DEFAULT_MODEL.value,
            data.ALL_AVAILABLE_MODELS
          );
        }
      })
      .catch(() => {
        hideStatus();
        showToast("Failed to load active model", "error");
      });

    modelSelect.addEventListener("change", ({ target }) => {
      const selectedModel = target.value;
      showStatus(`Checking model: ${selectedModel}...`);

      fetch("http://localhost:3000/change-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: selectedModel }),
      })
        .then((res) => res.json())
        .then(({ error, activeModel }) => {
          hideStatus();
          showToast(
            error
              ? "Failed to change model"
              : `Model changed to ${activeModel}`,
            error ? "error" : "success"
          );
        })
        .catch(() => showToast("Error changing model", "error"));

      checkDownloadProgress(selectedModel, data.ALL_AVAILABLE_MODELS);
    });
  })
  .catch(() => showToast("Error loading models", "error"));

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
    infoCard.innerHTML = `You can now have a conversation with <span>PranAI - ${
      availableModelList
        ?.find((m) => m.value === selectedModel)
        ?.label?.split(" (")[0] ??
      selectedModel ??
      "AI Assist"
    }</span>`;
    chatContainer.appendChild(infoCard);
  };

  const updateProgressBar = () => {
    dots = (dots + 1) % 4;
    progressBar.innerText = `Downloading model${".".repeat(dots)}`;
    progressContainer.style.transition = "height 0.5s ease, opacity 0.5s ease";
    progressContainer.style.height = "30px";
    progressContainer.style.opacity = "1";
    inputArea.classList.add("disabled");
    modelDropdown.classList.add("disabled");
  };

  const completeDownload = () => {
    clearInterval(interval);
    progressContainer.style.backgroundColor = "#42b12e";
    progressBar.innerText = "Download Complete!";
    inputArea.classList.remove("disabled");
    modelDropdown.classList.remove("disabled");
    setTimeout(() => {
      progressContainer.style.height = "0px";
      progressContainer.style.opacity = "0";
    }, 2000);
    createInfoCard();
  };

  const interval = setInterval(async () => {
    try {
      const res = await fetch(
        `http://localhost:3000/download-progress?model=${encodeURIComponent(
          selectedModel
        )}`
      ).then((r) => r.json());
      if (res.progress >= 100 && res.modelExists) completeDownload();
      else if (res.progress > 0 || !res.modelExists) updateProgressBar();
      else clearInterval(interval);
    } catch {
      clearInterval(interval);
    }
  }, 1000);
}

function generateSessionId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 15);
}

let sessionId = localStorage.getItem("sessionId") || generateSessionId();
localStorage.setItem("sessionId", sessionId);

const MAX_HISTORY_LENGTH = 20;
async function sendMessage() {
  const input = document.getElementById("message");
  const message = input.value.trim();
  if (!message) return;

  const chatTitle = sessionId;
  let chatHistory = JSON.parse(localStorage.getItem("chatHistory")) || {};
  chatHistory[chatTitle] = chatHistory[chatTitle] || [];

  // Add user message to history
  chatHistory[chatTitle].push({ role: "user", content: message });

  // Trim history to maintain a max of 20 messages
  if (chatHistory[chatTitle].length > MAX_HISTORY_LENGTH) {
    chatHistory[chatTitle] = chatHistory[chatTitle].slice(-MAX_HISTORY_LENGTH);
  }

  localStorage.setItem("chatHistory", JSON.stringify(chatHistory));

  appendMessage(message, "user-message", true);
  input.value = "";

  const typingIndicator = appendMessage(
    "PranAI is typing...",
    "ai-message typing-indicator",
    true
  );
  let dots = 0;
  const typingAnimation = setInterval(() => {
    dots = (dots + 1) % 4;
    typingIndicator.innerText = "PranAI is typing" + ".".repeat(dots);
  }, 500);

  try {
    // Send trimmed chat history to server
    const res = await fetch("http://localhost:3000/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, messages: chatHistory[chatTitle] }),
    });

    clearInterval(typingAnimation);
    typingIndicator.remove();

    if (!res.ok) throw new Error("Error fetching response.");

    const reader = res.body.getReader();
    let aiMessageElement = appendMessage("", "ai-message");
    let aiMessageContent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = new TextDecoder().decode(value);
      aiMessageElement.innerText += chunk;
      aiMessageContent += chunk;
    }

    // Add AI response to chat history
    chatHistory[chatTitle].push({
      role: "assistant",
      content: aiMessageContent,
    });

    // Trim again after adding AI response
    if (chatHistory[chatTitle].length > MAX_HISTORY_LENGTH) {
      chatHistory[chatTitle] = chatHistory[chatTitle].slice(
        -MAX_HISTORY_LENGTH
      );
    }

    localStorage.setItem("chatHistory", JSON.stringify(chatHistory));
  } catch (error) {
    clearInterval(typingAnimation);
    typingIndicator.remove();
    appendMessage(
      "Error fetching response. Please try again.",
      "ai-message error",
      false
    );
  }
}

function appendMessage(text, className, disableTyping = false) {
  const chatContainer = document.getElementById("chat-container");
  const message = document.createElement("div");
  message.className = `message ${className}`;
  chatContainer.appendChild(message);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  if (disableTyping) {
    message.innerHTML = text;
    return message;
  }
  let index = 0;
  (function typeCharacter() {
    if (index < text.length) {
      message.innerHTML = text.slice(0, ++index);
      setTimeout(typeCharacter, 20);
    }
  })();
  return message;
}

const mainContent = document.getElementById("main-content");
const chatContainerA = document.getElementById("chat-container");
const scrollToBottomButton = document.createElement("button");
scrollToBottomButton.innerHTML = "▼";
scrollToBottomButton.classList.add("scroll-to-bottom");
mainContent.appendChild(scrollToBottomButton);

scrollToBottomButton.addEventListener("click", () => {
  chatContainerA.scrollTo({
    top: chatContainerA.scrollHeight,
    behavior: "smooth",
  });
  //scrollToBottomButton.style.display = "none";
});

chatContainerA.addEventListener("scroll", () => {
  if (
    chatContainerA.scrollHeight -
      chatContainerA.scrollTop -
      chatContainerA.clientHeight >
    200 // Adjust this value to control when the button appears
  ) {
    scrollToBottomButton.style.display = "block";
  } else {
    scrollToBottomButton.style.display = "none";
  }
});

//#region Chat History
function startNewChatSession() {
  let chatHistory = JSON.parse(localStorage.getItem("chatHistory")) || {};
  let currentSession = localStorage.getItem("sessionId");

  // Check if the current session has messages before creating a new one
  if (
    currentSession &&
    chatHistory[currentSession] &&
    chatHistory[currentSession].length === 0
  ) {
    showToast(
      "Cannot start a new session. Current session is empty.",
      "warning"
    );
    return;
  }

  sessionId = generateSessionId();
  localStorage.setItem("sessionId", sessionId);

  // Clear UI chat and input
  document.getElementById("chat-container").innerHTML = "";
  document.getElementById("message").value = "";

  // Initialize new session in chat history
  chatHistory[sessionId] = [];
  localStorage.setItem("chatHistory", JSON.stringify(chatHistory));

  showToast("New chat session started.", "success");

  loadChatHistory(); // Refresh chat history list
}

loadChatHistory();
function loadChatHistory() {
  const chatHistory = JSON.parse(localStorage.getItem("chatHistory")) || {};
  const chatHistoryContainer = document.getElementById("chat-history");
  chatHistoryContainer.innerHTML = "";

  Object.keys(chatHistory).forEach((session) => {
    const chatItem = document.createElement("div");
    chatItem.className = "sidebar-item";

    // for chat title
    const messages = chatHistory[session] || [];
    const firstUserMessage =
      messages.find((msg) => msg.role === "user")?.content || "New Chat";
    chatItem.innerText =
      firstUserMessage.length > 20
        ? firstUserMessage.slice(0, 20) + "..."
        : firstUserMessage;

    chatItem.addEventListener("click", () => loadChatSession(session));
    chatHistoryContainer.appendChild(chatItem);
  });
}

function loadChatSession(selectedSessionId) {
  sessionId = selectedSessionId;
  localStorage.setItem("sessionId", sessionId);

  const chatContainer = document.getElementById("chat-container");
  chatContainer.innerHTML = ""; // Clear current chat messages

  let chatHistory = JSON.parse(localStorage.getItem("chatHistory")) || {};
  let messages = chatHistory[selectedSessionId] || [];

  // Ensure the chat history doesn't exceed max messages
  if (messages.length > MAX_HISTORY_LENGTH) {
    messages = messages.slice(-MAX_HISTORY_LENGTH);
    chatHistory[selectedSessionId] = messages;
    localStorage.setItem("chatHistory", JSON.stringify(chatHistory));
  }

  // Display messages in UI
  messages.forEach((msg) => {
    appendMessage(
      msg.content,
      msg.role === "user" ? "user-message" : "ai-message",
      true
    );
  });

  showToast("Loaded previous chat.", "info");
}
