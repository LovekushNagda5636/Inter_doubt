const messagesEl = document.getElementById("messages");
const contextLabel = document.getElementById("contextLabel");
const refreshBtn = document.getElementById("refreshBtn");
const setupNotice = document.getElementById("setupNotice");
const composer = document.getElementById("composer");
const input = document.getElementById("input");
const sendBtn = document.getElementById("sendBtn");
const settingsBtn = document.getElementById("settingsBtn");
const openSettings = document.getElementById("openSettings");

let activeTabId = null;
let capturedContext = null; // { url, title, turns }
let history = []; // this side panel's own Q&A, independent of the main chat

function renderEmptyState() {
  if (messagesEl.children.length === 0) {
    const div = document.createElement("div");
    div.className = "empty-state";
    div.textContent =
      "Ask anything about what's currently open in your main chat. This is a separate scratch conversation — it won't scroll or change your main chat at all.";
    messagesEl.appendChild(div);
  }
}

function clearEmptyState() {
  const empty = messagesEl.querySelector(".empty-state");
  if (empty) empty.remove();
}

function addMessage(role, text) {
  clearEmptyState();
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.textContent = text;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div;
}

async function getActiveTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id ?? null;
}

async function captureContext(showFeedback = false) {
  if (!activeTabId) {
    activeTabId = await getActiveTabId();
  }
  if (!activeTabId) {
    contextLabel.textContent = "No active tab found";
    return;
  }
  if (showFeedback) contextLabel.textContent = "Capturing context…";

  chrome.runtime.sendMessage(
    { type: "EXTRACT_CONTEXT", tabId: activeTabId },
    (response) => {
      if (!response?.ok || !response.data) {
        contextLabel.textContent = "Couldn't read this page (open it on claude.ai and reload).";
        return;
      }
      capturedContext = response.data;
      const chars = (capturedContext.turns || []).reduce((n, t) => n + t.text.length, 0);
      const turnCount = capturedContext.turns?.length || 0;
      contextLabel.textContent = `Captured ${turnCount} block${turnCount === 1 ? "" : "s"} (${chars.toLocaleString()} chars) from "${capturedContext.title || capturedContext.url}"`;
    }
  );
}

async function checkPendingSelection() {
  if (!activeTabId) return;
  const key = `pendingSelection:${activeTabId}`;
  const data = await chrome.storage.session.get(key);
  const selection = data[key];
  if (selection) {
    input.value = `About this: "${selection}"\n\n`;
    input.focus();
    await chrome.storage.session.remove(key);
  }
}

function buildSystemPrompt() {
  let ctx = "No page context was captured.";
  if (capturedContext && capturedContext.turns?.length) {
    ctx = capturedContext.turns
      .map((t) => `[${t.role}]: ${t.text}`)
      .join("\n\n");
  }
  return [
    "You are a side-panel study assistant. The user has a main chat/document open in another window and is reading or studying it right now.",
    "They opened this side panel to ask a quick doubt WITHOUT scrolling back through their main conversation.",
    "Answer their question using the captured context below when relevant. Be concise and direct — this is a quick clarification, not a new essay.",
    "If the context doesn't contain what they're asking about, say so plainly and answer from general knowledge instead.",
    "",
    `Page: ${capturedContext?.title || "unknown"} (${capturedContext?.url || "unknown"})`,
    "Captured context:",
    ctx,
  ].join("\n");
}

async function callAnthropic(apiKey, model, systemPrompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: model || "claude-sonnet-5",
      max_tokens: 1024,
      system: systemPrompt,
      messages: history,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`API error ${res.status}: ${errBody.slice(0, 300)}`);
  }

  const data = await res.json();
  return (
    (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim() || "(no response)"
  );
}

async function callXai(apiKey, model, systemPrompt) {
  // xAI's Grok API is OpenAI-compatible: chat/completions with a system message.
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || "grok-4",
      messages: [{ role: "system", content: systemPrompt }, ...history],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`API error ${res.status}: ${errBody.slice(0, 300)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || "(no response)";
}

async function sendDoubt(text) {
  const { apiKey, model, provider } = await chrome.storage.local.get([
    "apiKey",
    "model",
    "provider",
  ]);
  if (!apiKey) {
    setupNotice.classList.remove("hidden");
    return;
  }
  setupNotice.classList.add("hidden");

  addMessage("user", text);
  history.push({ role: "user", content: text });

  const thinking = addMessage("assistant", "Thinking…");
  sendBtn.disabled = true;

  try {
    const systemPrompt = buildSystemPrompt();
    const answer =
      provider === "xai"
        ? await callXai(apiKey, model, systemPrompt)
        : await callAnthropic(apiKey, model, systemPrompt);

    thinking.textContent = answer;
    history.push({ role: "assistant", content: answer });
  } catch (err) {
    thinking.textContent = `Something went wrong: ${err.message}`;
    history.pop(); // don't poison future turns with a failed exchange
  } finally {
    sendBtn.disabled = false;
  }
}

composer.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  sendDoubt(text);
});

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    composer.requestSubmit();
  }
});

refreshBtn.addEventListener("click", () => captureContext(true));
settingsBtn.addEventListener("click", () => chrome.runtime.openOptionsPage());
openSettings.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

(async function init() {
  renderEmptyState();
  const { apiKey } = await chrome.storage.local.get("apiKey");
  if (!apiKey) setupNotice.classList.remove("hidden");

  activeTabId = await getActiveTabId();
  await captureContext(false);
  await checkPendingSelection();
})();

// Keep context capture in sync if the user switches tabs while the panel is open.
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  activeTabId = tabId;
  await captureContext(false);
  await checkPendingSelection();
});
