# PranAI - Offline AI Chat Assistant

![PranAI Screenshot](path/to/screenshot.png)  
_A lightweight, open-source AI chat assistant that works offline with multiple model selection. Free to use, private, and built using Electron & Express._  

## 🚀 Features  

- **Offline Mode**: No internet required after model download.  
- **Multiple Open-Source LLMs**: Download and use any [Ollama-compatible model](https://ollama.com/search).  
- **Session Memory**: Keeps track of your conversations.  
- **Switch Models Instantly**: Change AI models on the go during chats.  
- **Privacy Focused**: All data stays on your local machine.  

## 👅 Installation  

### Prerequisites  

- [Node.js](https://nodejs.org/) (LTS Recommended)  
- [Electron](https://www.electronjs.org/)  
- [Ollama](https://ollama.ai/) installed and configured  

### Steps  

```sh
# Clone the repository
git clone https://github.com/yourusername/pranai-offline-ai-chat-assist.git
cd pranai-offline-ai-chat-assist

# Install dependencies
npm install

# Start the application
npm start
```  

## 🔧 Adding Models  

You can add custom [Ollama-compatible models](https://ollama.com/search) to PranAI:  

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
  "label": "Your Model Name (any name you prefer)", "value": "model_identifier"
}
```

**Example:**

```json
{
  "label": "DeepSeek", "value": "deepseek-r1" 
}
```

This will use: `ollama pull deepseek-r1`


4. Restart PranAI and select the model from the **Model Selection** panel. The model will be downloaded once and stored locally in Ollama.  

## ⚠️ Project Status  

This project is a personal project built for learning purposes within 2 days. It requires refactoring, optimization, and several improvements. Contributions and suggestions are welcome!  

## 🐜 License  

This project is licensed under the [ISC License](LICENSE).  

## 🤝 Contributing  

1. Fork the repository.  
2. Create a new branch (`feature/new-feature`).  
3. Commit your changes.  
4. Push to your fork.  
5. Open a Pull Request.  

---  

For any issues, suggestions, or feature requests, feel free to open an issue in the repository!  

**Happy Chatting! 🤖**

