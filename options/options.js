const providerSelect = document.getElementById("provider");
const apiKeyInput = document.getElementById("apiKey");
const apiKeyLabel = document.getElementById("apiKeyLabel");
const apiKeyHint = document.getElementById("apiKeyHint");
const modelInput = document.getElementById("model");
const modelSuggestions = document.getElementById("modelSuggestions");
const status = document.getElementById("status");

Object.entries(PROVIDERS).forEach(([id, cfg]) => {
  const opt = document.createElement("option");
  opt.value = id;
  opt.textContent = cfg.label;
  providerSelect.appendChild(opt);
});

function applyProvider(providerId, savedModel) {
  const cfg = PROVIDERS[providerId] || PROVIDERS[DEFAULT_PROVIDER];
  apiKeyLabel.textContent = cfg.keyLabel;
  apiKeyHint.textContent = cfg.keyHint;
  apiKeyInput.placeholder = cfg.keyPlaceholder;

  modelSuggestions.innerHTML = "";
  cfg.modelSuggestions.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m;
    modelSuggestions.appendChild(opt);
  });

  modelInput.value = savedModel || cfg.defaultModel;
}

chrome.storage.local.get(["provider", "apiKey", "model"], (data) => {
  const providerId = PROVIDERS[data.provider] ? data.provider : DEFAULT_PROVIDER;
  providerSelect.value = providerId;
  applyProvider(providerId, data.provider === providerId ? data.model : null);
  if (data.apiKey) apiKeyInput.value = data.apiKey;
});

providerSelect.addEventListener("change", () => {
  apiKeyInput.value = "";
  applyProvider(providerSelect.value);
});

document.getElementById("save").addEventListener("click", () => {
  const provider = providerSelect.value;
  const apiKey = apiKeyInput.value.trim();
  const model = modelInput.value.trim();
  chrome.storage.local.set({ provider, apiKey, model }, () => {
    status.textContent = "Saved.";
    setTimeout(() => (status.textContent = ""), 2000);
  });
});
