const providerSelect = document.getElementById("provider");
const apiKeyInput = document.getElementById("apiKey");
const apiKeyLabel = document.getElementById("apiKeyLabel");
const apiKeyHint = document.getElementById("apiKeyHint");
const modelInput = document.getElementById("model");
const modelSuggestions = document.getElementById("modelSuggestions");
const modelHint = document.getElementById("modelHint");
const fetchModelsBtn = document.getElementById("fetchModelsBtn");
const status = document.getElementById("status");

const DEFAULT_MODEL_HINT =
  'Suggestions shown are examples — providers change these over time. Enter your API key above, then click "Fetch models" to pull the live list for your account.';

Object.entries(PROVIDERS).forEach(([id, cfg]) => {
  const opt = document.createElement("option");
  opt.value = id;
  opt.textContent = cfg.label;
  providerSelect.appendChild(opt);
});

function setModelSuggestions(models) {
  modelSuggestions.innerHTML = "";
  models.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m;
    modelSuggestions.appendChild(opt);
  });
}

function applyProvider(providerId, savedModel) {
  const cfg = PROVIDERS[providerId] || PROVIDERS[DEFAULT_PROVIDER];
  apiKeyLabel.textContent = cfg.keyLabel;
  apiKeyHint.textContent = cfg.keyHint;
  apiKeyInput.placeholder = cfg.keyPlaceholder;
  modelHint.textContent = DEFAULT_MODEL_HINT;

  setModelSuggestions(cfg.modelSuggestions);
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

fetchModelsBtn.addEventListener("click", async () => {
  const provider = providerSelect.value;
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    modelHint.textContent = "Enter your API key first.";
    return;
  }
  fetchModelsBtn.disabled = true;
  fetchModelsBtn.textContent = "Fetching…";
  try {
    const models = await listModels(provider, apiKey);
    if (models.length === 0) {
      modelHint.textContent = "No models returned for this key.";
      return;
    }
    setModelSuggestions(models);
    modelHint.textContent = `Loaded ${models.length} model${models.length === 1 ? "" : "s"} from your account — pick one from the list.`;
  } catch (err) {
    modelHint.textContent = `Couldn't fetch models: ${err.message}`;
  } finally {
    fetchModelsBtn.disabled = false;
    fetchModelsBtn.textContent = "Fetch models";
  }
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
