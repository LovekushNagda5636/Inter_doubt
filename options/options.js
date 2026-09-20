const providerSelect = document.getElementById("provider");
const apiKeyInput = document.getElementById("apiKey");
const apiKeyLabel = document.getElementById("apiKeyLabel");
const apiKeyHint = document.getElementById("apiKeyHint");
const modelSelect = document.getElementById("model");
const status = document.getElementById("status");

const PROVIDERS = {
  anthropic: {
    label: "Anthropic API key",
    hint: "Get a key at console.anthropic.com.",
    placeholder: "sk-ant-...",
    models: ["claude-sonnet-5", "claude-opus-5", "claude-haiku-4-5-20251001"],
  },
  xai: {
    label: "xAI API key",
    hint: "Get a key at console.x.ai.",
    placeholder: "xai-...",
    models: ["grok-4", "grok-4-fast", "grok-3"],
  },
};

function applyProvider(provider, selectedModel) {
  const cfg = PROVIDERS[provider] || PROVIDERS.anthropic;
  apiKeyLabel.textContent = cfg.label;
  apiKeyHint.textContent = cfg.hint;
  apiKeyInput.placeholder = cfg.placeholder;

  modelSelect.innerHTML = "";
  cfg.models.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;
    modelSelect.appendChild(opt);
  });
  if (selectedModel && cfg.models.includes(selectedModel)) {
    modelSelect.value = selectedModel;
  }
}

chrome.storage.local.get(["provider", "apiKey", "model"], (data) => {
  const provider = data.provider || "anthropic";
  providerSelect.value = provider;
  applyProvider(provider, data.model);
  if (data.apiKey) apiKeyInput.value = data.apiKey;
});

providerSelect.addEventListener("change", () => {
  apiKeyInput.value = "";
  applyProvider(providerSelect.value);
});

document.getElementById("save").addEventListener("click", () => {
  const provider = providerSelect.value;
  const apiKey = apiKeyInput.value.trim();
  const model = modelSelect.value;
  chrome.storage.local.set({ provider, apiKey, model }, () => {
    status.textContent = "Saved.";
    setTimeout(() => (status.textContent = ""), 2000);
  });
});
