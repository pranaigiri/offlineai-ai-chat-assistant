# OfflineAI – Not a Big Deal, Just a Learning Experiment!

![5](https://github.com/user-attachments/assets/760ddbe0-e663-461d-9030-4d69c8712dd6)

_A lightweight, open-source AI chat assistant that works offline with multiple model selection. Free to use, private, built using Electron & Express._

## 🚀 Features

- **Offline Mode**: No internet required after model download.
- **Multiple Open-Source LLMs**: Download and use any [Ollama-compatible model](https://ollama.com/search).
- **Session Memory**: Keeps track of your conversations.
- **Switch Models Instantly**: Change AI models on the go during chats.
- **Privacy Focused**: All data stays on your local machine.

## 👅 Installation

### Prerequisites

- [Ollama](https://ollama.ai/) installed and configured
- [Node.js](https://nodejs.org/) (LTS Recommended)
- [Electron](https://www.electronjs.org/)

### Steps

```sh
# Clone the repository
git clone https://github.com/yourusername/offlineai-offline-ai-chat-assist.git
cd offlineai-offline-ai-chat-assist

# Install dependencies
npm install

# Start the application
npm start
```

## 🔧 Adding Models

You can add custom [Ollama-compatible models](https://ollama.com/search) to OfflineAI:

1. Open `config/config.json`.
2. Add the model details under `ALL_AVAILABLE_MODELS`.
3. Ensure the `value` matches the model name used in `ollama pull "model_name"`.

### Example:

```json
{
  "DEFAULT_MODEL": { "label": "SmolLM2 (213MB)", "value": "smollm2:135m" },
  "ALL_AVAILABLE_MODELS": [
    { "label": "Tiny Llama (637MB)", "value": "tinyllama:latest" },
    { "label": "Qwen 2.5 (397MB)", "value": "qwen2.5:0.5b" },
    { "label": "SmolLM2 (270MB)", "value": "smollm2:135m" }
  ]
}
```

**To change a default model, replace the object in `DEFAULT_MODEL` from `ALL_AVAILABLE_MODELS`:**

```json
{
  "DEFAULT_MODEL": { "label": "Qwen 2.5 (397MB)", "value": "qwen2.5:0.5b" }
}
```

**To add a new model, insert it in the `ALL_AVAILABLE_MODELS` array using the following format:**

```json
{
  "label": "Your Model Name (any name you prefer)",
  "value": "model_identifier"
}
```

**Example:**

```json
{
  "label": "DeepSeek",
  "value": "deepseek-r1"
}
```

This will use: `ollama pull deepseek-r1`

4. Restart OfflineAI and select the model from the **Model Selection** panel. The model will be downloaded once and stored locally in Ollama.

## ⚠️ Project Status

This project is in an early development stage and will continue improving with refactoring and optimizations. Contributions and suggestions are welcome!

### 🌠 Improvements Needed

- **Realtime Download Progress:** Parse and display the progress of `ollama pull` execution, although progress information is visible in the console.
- **Remove Flickering on Code Highlight:** Flickering issues when displaying code snippets with syntax highlighting.
- **Live Server Compatibility:** Making the app function in a live server environment without Electron.

## 🐜 License

This project is licensed under the [ISC License](LICENSE).

## 🤝 How to Contribute

We welcome contributions to improve OfflineAI! Here’s how you can help:

- **Bug Fixes & Optimizations**: Identify and fix issues or improve performance.
- **Feature Enhancements**: Suggest and implement new features.
- **UI/UX Improvements**: Enhance the user experience and design.
- **Documentation**: Improve existing documentation or add missing details.

### Contribution Steps

1. Fork the repository.
2. Create a new branch (`feature/new-feature`).
3. Commit your changes.
4. Push to your fork.
5. Open a Pull Request.

## 📸 Preview

Here are some previews of OfflineAI in action:

### Chat with the Latest Models - Gemma 3 and Deepseek R1

![3](https://github.com/user-attachments/assets/86ee0efa-1e92-4f10-af7c-7b75976d8470)


### Highlight & Chat History

![1](https://github.com/user-attachments/assets/02fc9afb-d488-4c5a-a2f2-4966676efb8e)


### Desktop Mode

![2](https://github.com/user-attachments/assets/1a246d6b-bee9-4e95-b563-2ce125085b8a)


### Chat Memory

![4](https://github.com/user-attachments/assets/5b26f680-f2e6-4044-910f-c8ef77ce1b3e)


---

For any issues, suggestions, or feature requests, feel free to open an issue in the repository!

**Happy Chatting! 🤖**
