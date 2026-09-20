const apiKeyInput = document.getElementById("apiKey");
const modelSelect = document.getElementById("model");
const status = document.getElementById("status");

chrome.storage.local.get(["apiKey", "model"], (data) => {
  if (data.apiKey) apiKeyInput.value = data.apiKey;
  if (data.model) modelSelect.value = data.model;
});

document.getElementById("save").addEventListener("click", () => {
  const apiKey = apiKeyInput.value.trim();
  const model = modelSelect.value;
  chrome.storage.local.set({ apiKey, model }, () => {
    status.textContent = "Saved.";
    setTimeout(() => (status.textContent = ""), 2000);
  });
});
