// Shared provider config + API calls, loaded as a plain classic script by
// both options.html and sidepanel.html (so its top-level declarations are
// visible to the script tags that follow it in each page).

const PROVIDERS = {
  anthropic: {
    label: "Anthropic (Claude)",
    keyLabel: "Anthropic API key",
    keyPlaceholder: "sk-ant-...",
    keyHint: "Get a key at console.anthropic.com.",
    defaultModel: "claude-sonnet-5",
    modelSuggestions: ["claude-sonnet-5", "claude-opus-5", "claude-haiku-4-5-20251001"],
  },
  openai: {
    label: "OpenAI (ChatGPT)",
    keyLabel: "OpenAI API key",
    keyPlaceholder: "sk-...",
    keyHint: "Get a key at platform.openai.com/api-keys.",
    defaultModel: "gpt-4o",
    modelSuggestions: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "o3-mini"],
  },
  xai: {
    label: "xAI (Grok)",
    keyLabel: "xAI API key",
    keyPlaceholder: "xai-...",
    keyHint: "Get a key at console.x.ai.",
    defaultModel: "grok-4",
    modelSuggestions: ["grok-4", "grok-4-fast", "grok-3"],
  },
  gemini: {
    label: "Google (Gemini)",
    keyLabel: "Google AI API key",
    keyPlaceholder: "AIza...",
    keyHint: "Get a key at aistudio.google.com/apikey.",
    defaultModel: "gemini-2.5-flash",
    modelSuggestions: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
  },
  groq: {
    label: "Groq",
    keyLabel: "Groq API key",
    keyPlaceholder: "gsk_...",
    keyHint: "Get a key at console.groq.com/keys. Not to be confused with xAI's Grok.",
    defaultModel: "llama-3.3-70b-versatile",
    modelSuggestions: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "gemma2-9b-it"],
  },
};

const DEFAULT_PROVIDER = "anthropic";

async function readErrorBody(res) {
  const body = await res.text();
  return `API error ${res.status}: ${body.slice(0, 300)}`;
}

async function callAnthropic(apiKey, model, systemPrompt, history) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: model || PROVIDERS.anthropic.defaultModel,
      max_tokens: 1024,
      system: systemPrompt,
      messages: history,
    }),
  });

  if (!res.ok) throw new Error(await readErrorBody(res));

  const data = await res.json();
  return (
    (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim() || "(no response)"
  );
}

async function callOpenAiCompatible(baseUrl, apiKey, model, defaultModel, systemPrompt, history) {
  // Shared shape for OpenAI's own API and any OpenAI-compatible endpoint (xAI's Grok included).
  const res = await fetch(baseUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || defaultModel,
      messages: [{ role: "system", content: systemPrompt }, ...history],
    }),
  });

  if (!res.ok) throw new Error(await readErrorBody(res));

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || "(no response)";
}

async function callGemini(apiKey, model, systemPrompt, history) {
  const m = model || PROVIDERS.gemini.defaultModel;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: history.map((h) => ({
          role: h.role === "assistant" ? "model" : "user",
          parts: [{ text: h.content }],
        })),
      }),
    }
  );

  if (!res.ok) throw new Error(await readErrorBody(res));

  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text || "").join("").trim() || "(no response)";
}

async function callProvider(provider, apiKey, model, systemPrompt, history) {
  switch (provider) {
    case "openai":
      return callOpenAiCompatible(
        "https://api.openai.com/v1/chat/completions",
        apiKey,
        model,
        PROVIDERS.openai.defaultModel,
        systemPrompt,
        history
      );
    case "xai":
      return callOpenAiCompatible(
        "https://api.x.ai/v1/chat/completions",
        apiKey,
        model,
        PROVIDERS.xai.defaultModel,
        systemPrompt,
        history
      );
    case "gemini":
      return callGemini(apiKey, model, systemPrompt, history);
    case "groq":
      return callOpenAiCompatible(
        "https://api.groq.com/openai/v1/chat/completions",
        apiKey,
        model,
        PROVIDERS.groq.defaultModel,
        systemPrompt,
        history
      );
    case "anthropic":
    default:
      return callAnthropic(apiKey, model, systemPrompt, history);
  }
}
