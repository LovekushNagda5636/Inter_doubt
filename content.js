// Content script: read-only extraction of the visible conversation on the
// page. It never writes to the page, so the main chat is untouched no
// matter how often the side panel asks for a refresh.

function textOf(el) {
  return (el.innerText || el.textContent || "").trim();
}

function extractClaudeAi() {
  const turns = [];
  // Claude.ai renders each turn inside [data-testid="user-message"] or
  // the assistant message body; selectors are best-effort and fall back
  // to a generic scan below if the DOM has changed.
  const nodes = document.querySelectorAll(
    '[data-testid="user-message"], [data-testid="chat-message"], .font-claude-message, .font-user-message'
  );
  nodes.forEach((node) => {
    const text = textOf(node);
    if (!text) return;
    const isUser = node.matches('[data-testid="user-message"], .font-user-message');
    turns.push({ role: isUser ? "user" : "assistant", text });
  });
  return turns;
}

function extractChatGpt() {
  const turns = [];
  const nodes = document.querySelectorAll("[data-message-author-role]");
  nodes.forEach((node) => {
    const text = textOf(node);
    if (!text) return;
    const role = node.getAttribute("data-message-author-role");
    turns.push({ role: role === "user" ? "user" : "assistant", text });
  });
  return turns;
}

function extractGemini() {
  const turns = [];
  const nodes = document.querySelectorAll(
    "user-query, model-response, .query-text, .response-content"
  );
  nodes.forEach((node) => {
    const text = textOf(node);
    if (!text) return;
    const isUser = node.tagName?.toLowerCase() === "user-query" || node.matches(".query-text");
    turns.push({ role: isUser ? "user" : "assistant", text });
  });
  return turns;
}

function extractGeneric() {
  // Last-resort fallback: grab the visible text of <main>, or the body.
  const root = document.querySelector("main") || document.body;
  return [{ role: "page", text: textOf(root).slice(0, 20000) }];
}

function extractConversation() {
  const host = location.hostname;
  let turns = [];
  if (host.includes("claude.ai")) turns = extractClaudeAi();
  else if (host.includes("chatgpt.com")) turns = extractChatGpt();
  else if (host.includes("gemini.google.com")) turns = extractGemini();

  if (turns.length === 0) turns = extractGeneric();

  // Cap total size so we don't blow the model's context window; keep the
  // most recent turns since that's almost always what a "doubt" refers to.
  const MAX_CHARS = 24000;
  let total = 0;
  const kept = [];
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i];
    total += t.text.length;
    kept.unshift(t);
    if (total >= MAX_CHARS) break;
  }

  return {
    url: location.href,
    title: document.title,
    turns: kept,
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "EXTRACT_CONTEXT") {
    try {
      sendResponse(extractConversation());
    } catch (err) {
      sendResponse({ url: location.href, title: document.title, turns: [], error: String(err) });
    }
  }
});
