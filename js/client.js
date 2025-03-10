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
      if (event.shiftKey) {
        // Allow new line on Shift + Enter
        event.preventDefault();
        messageInput.setRangeText(
          "\n",
          messageInput.selectionStart,
          messageInput.selectionEnd,
          "end"
        );
      } else {
        // Send message on Enter
        event.preventDefault();
        sendMessage();
      }
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

fetch("config/config.json")
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
        .finally(() => {
          checkDownloadProgress(selectedModel, data.ALL_AVAILABLE_MODELS);
        })
        .catch(() => showToast("Error changing model", "error"));
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

    scrollChatToBottom();
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
    removeWelcomeMessage();
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
    let aiMessageElement = appendMessage("", "ai-message"); // Create an empty div
    let aiMessageContent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = new TextDecoder().decode(value);
      aiMessageContent += chunk; // Append the new chunk to the message content

      // Update the AI message with Markdown rendering
      aiMessageElement.innerHTML = marked.parse(aiMessageContent);

      // Reapply syntax highlighting to code blocks
      setTimeout(() => {
        document.querySelectorAll("pre code").forEach((block) => {
          hljs.highlightElement(block);
          addCopyButton(block);
        });
      }, 0); // Slight delay ensures text is updated before highlighting
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

function removeWelcomeMessage() {
  const welcomeMsgContainer = document.getElementById("welcome-message");
  if (welcomeMsgContainer) {
    welcomeMsgContainer.style.display = "none";
  }
}

function addWelcomeMessage() {
  const welcomeMsgContainer = document.getElementById("welcome-message");
  if (welcomeMsgContainer) {
    welcomeMsgContainer.style.display = "flex";
  }
}

function appendMessage(text, className, disableTyping = false) {
  removeWelcomeMessage();
  const chatContainer = document.getElementById("chat-container");
  const message = document.createElement("div");
  message.className = `message ${className}`;
  chatContainer.appendChild(message);
  chatContainer.scrollTop = chatContainer.scrollHeight;

  // Handle Markdown and syntax highlighting immediately if typing is disabled
  if (disableTyping) {
    message.innerHTML = marked.parse(text);
    applySyntaxHighlighting();
    return message;
  }

  // Typing effect without flickering
  let index = 0;
  let tempText = "";
  let preRendered = marked.parse(text); // Pre-render Markdown to avoid flickering
  let charArray = text.split(""); // Convert text into an array

  (function typeCharacter() {
    if (index < charArray.length) {
      tempText += charArray[index++];
      message.innerHTML = marked.parse(tempText); // Render Markdown without re-parsing
      applySyntaxHighlighting();
      setTimeout(typeCharacter, 20);
    }
  })();

  return message;
}

// Function to apply syntax highlighting and add copy button
function applySyntaxHighlighting() {
  document.querySelectorAll("pre code").forEach((block) => {
    hljs.highlightElement(block);
    addCopyButton(block);
  });
}

// Function to add a copy button to code blocks
function addCopyButton(codeBlock) {
  const pre = codeBlock.parentElement;
  pre.style.position = "relative";
  pre.style.overflowX = "auto"; // Enable horizontal scrolling for long code blocks

  if (pre.querySelector(".copy-btn")) return; // Prevent duplicate buttons

  const button = document.createElement("button");
  button.innerText = "Copy";
  button.className = "copy-btn";
  button.style.position = "absolute";
  button.style.top = "8px";
  button.style.right = "8px";
  button.style.padding = "4px 8px";
  button.style.fontSize = "12px";
  button.style.border = "none";
  button.style.cursor = "pointer";
  button.style.background = "#444";
  button.style.color = "#fff";
  button.style.borderRadius = "4px";

  button.addEventListener("click", () => {
    navigator.clipboard.writeText(codeBlock.innerText).then(() => {
      button.innerText = "Copied!";
      setTimeout(() => (button.innerText = "Copy"), 1500);
    });
  });

  pre.appendChild(button);
}

const inputInnerContent = document.getElementById("input-area-inner");
const chatContainerA = document.getElementById("chat-outer-container");
const scrollToBottomButton = document.createElement("button");
scrollToBottomButton.innerHTML = "▼";
scrollToBottomButton.classList.add("scroll-to-bottom");
inputInnerContent.appendChild(scrollToBottomButton);

scrollToBottomButton.addEventListener("click", () => {
  chatContainerA.scrollTo({
    top: chatContainerA.scrollHeight,
    behavior: "smooth",
  });
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

  // Check if there's already an empty session
  let emptySessionId = Object.keys(chatHistory).find(
    (sessionId) => chatHistory[sessionId].length === 0
  );

  if (emptySessionId) {
    // Switch to the empty session instead of creating a new one
    sessionId = emptySessionId;
    localStorage.setItem("sessionId", sessionId);
    showToast("Switched to an existing empty session.", "info");
  } else {
    // If no empty session exists, create a new one
    sessionId = generateSessionId();
    chatHistory[sessionId] = [];
    localStorage.setItem("sessionId", sessionId);
    localStorage.setItem("chatHistory", JSON.stringify(chatHistory));
    showToast("New chat session started.", "success");
  }

  // Clear UI chat and input
  document.getElementById("chat-container").innerHTML = "";
  document.getElementById("message").value = "";

  loadChatHistory(); // Refresh chat history list
}

function loadChatHistory() {
  const chatHistory = JSON.parse(localStorage.getItem("chatHistory")) || {};
  const chatHistoryContainer = document.getElementById("chat-history");
  chatHistoryContainer.innerHTML = "";

  const currentSession = localStorage.getItem("sessionId"); // Get active session ID

  // Reverse the session order to show the latest on top
  Object.keys(chatHistory)
    .reverse()
    .forEach((session) => {
      const chatItem = document.createElement("div");
      chatItem.className = "sidebar-item";

      // Highlight active session
      if (session === currentSession) {
        chatItem.classList.add("active");
      }

      // Get the first user message as the chat title
      const messages = chatHistory[session] || [];
      const firstUserMessage =
        messages.find((msg) => msg.role === "user")?.content || "New Chat";

      chatItem.innerText =
        firstUserMessage.length > 20
          ? firstUserMessage.slice(0, 20) + "..."
          : firstUserMessage;

      chatItem.addEventListener("click", () => {
        loadChatSession(session);

        // Remove 'active' class from all chat items
        document.querySelectorAll(".sidebar-item").forEach((item) => {
          item.classList.remove("active");
        });

        // Add 'active' class to the clicked chat item
        chatItem.classList.add("active");
      });

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

  if (messages.length == 0) {
    addWelcomeMessage();
  } else {
    removeWelcomeMessage();
  }

  showToast("Loaded previous chat.", "info");
}

function scrollChatToBottom() {
  const chatOuterContainer = document.getElementById("chat-outer-container");
  if (chatOuterContainer) {
    chatOuterContainer.scrollTo({
      top: chatOuterContainer.scrollHeight,
      behavior: "smooth",
    });
  }
}

startNewChatSession();
