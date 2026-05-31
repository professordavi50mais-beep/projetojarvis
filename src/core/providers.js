import { existsSync, readFileSync } from "node:fs";

export class ProviderRouter {
  constructor({ soul }) {
    this.soul = soul;
    this.providers = [
      provider("openai", "OPENAI_API_KEY", ["general", "code", "summarize", "fast"], {
        model: env("OPENAI_MODEL") ?? "gpt-4.1-mini"
      }),
      provider("openrouter", "OPENROUTER_API_KEY", ["general", "code", "summarize", "fast"], {
        model: env("OPENROUTER_MODEL") ?? "openai/gpt-4o-mini"
      }),
      provider("anthropic", "ANTHROPIC_API_KEY", ["general", "code"]),
      provider("google", "GOOGLE_API_KEY", ["fast", "general"]),
      {
        name: "ollama",
        enabled: env("JARVS_DISABLE_OLLAMA") !== "1",
        tasks: ["general", "code", "summarize", "fast"],
        baseUrl: env("OLLAMA_BASE_URL") ?? "http://localhost:11434",
        model: env("OLLAMA_MODEL") ?? "llama3.2"
      },
      { name: "mock", enabled: true, tasks: ["general", "code", "summarize", "fast"] }
    ];
  }

  available() {
    return this.providers.map((item) => ({ name: item.name, enabled: item.enabled, tasks: item.tasks }));
  }

  async complete({ taskType, messages }) {
    const selected = this.providers.find((item) => item.enabled && item.tasks.includes(taskType)) ?? this.providers.at(-1);
    if (selected.name === "mock") {
      const last = messages.at(-1)?.content ?? "";
      return {
        provider: "mock",
        text: `Modo mock ativo. Recebi: "${last}". Configure OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY ou OPENROUTER_API_KEY para respostas reais.`
      };
    }
    if (selected.name === "openai") {
      return completeWithOpenAI(selected, messages);
    }
    if (selected.name === "openrouter") {
      return completeWithOpenRouter(selected, messages);
    }
    if (selected.name === "ollama") {
      const result = await completeWithOllama(selected, messages);
      if (result.ok) return result.response;
      const fallback = this.providers.find((item) => item.name === "mock");
      const last = messages.at(-1)?.content ?? "";
      return {
        provider: fallback.name,
        text: `Ollama nao esta respondendo em ${selected.baseUrl}. Abra o Ollama e baixe o modelo "${selected.model}". Mensagem recebida: "${last}".`
      };
    }
    return {
      provider: selected.name,
      text: `Provider ${selected.name} selecionado para tarefa "${taskType}". O adaptador HTTP real deve ser conectado em src/core/providers.js.`
    };
  }
}

async function completeWithOpenRouter(provider, messages) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${provider.apiKey}`,
      "http-referer": "http://localhost:8787",
      "x-title": "ProfDavi50+"
    },
    body: JSON.stringify({
      model: provider.model,
      messages: messages.map((message) => ({
        role: message.role === "system" ? "system" : message.role === "assistant" ? "assistant" : "user",
        content: message.content
      }))
    })
  }).catch((error) => ({ ok: false, error }));

  if (!response.ok) {
    const payload = response.json ? await response.json().catch(() => ({})) : {};
    const message = response.error?.message ?? payload.error?.message ?? `HTTP ${response.status ?? "network"}`;
    return {
      provider: "openrouter",
      text: `Nao consegui chamar o OpenRouter: ${message}`
    };
  }

  const payload = await response.json().catch(() => ({}));
  return {
    provider: "openrouter",
    text: payload.choices?.[0]?.message?.content ?? "OpenRouter respondeu, mas nao retornou texto."
  };
}

async function completeWithOllama(provider, messages) {
  const response = await fetch(`${provider.baseUrl}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: provider.model,
      stream: false,
      messages: messages.map((message) => ({
        role: message.role === "system" ? "system" : message.role === "assistant" ? "assistant" : "user",
        content: message.content
      }))
    })
  }).catch((error) => ({ ok: false, error }));

  if (!response.ok) return { ok: false, error: response.error ?? response.status };
  const payload = await response.json().catch(() => ({}));
  return {
    ok: true,
    response: {
      provider: "ollama",
      text: payload.message?.content ?? "Ollama respondeu, mas nao retornou texto."
    }
  };
}

async function completeWithOpenAI(provider, messages) {
  const system = messages.find((message) => message.role === "system")?.content ?? "";
  const userMessages = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.content
    }));

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${provider.apiKey}`
    },
    body: JSON.stringify({
      model: provider.model,
      instructions: system,
      input: userMessages,
      store: false
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.error?.message ?? `HTTP ${response.status}`;
    return {
      provider: "openai",
      text: `Nao consegui chamar a OpenAI: ${message}`
    };
  }

  return {
    provider: "openai",
    text: extractOutputText(payload) || "A OpenAI respondeu, mas nao retornou texto."
  };
}

function extractOutputText(payload) {
  if (payload.output_text) return payload.output_text;
  const chunks = [];
  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && content.text) chunks.push(content.text);
      if (content.type === "text" && content.text) chunks.push(content.text);
    }
  }
  return chunks.join("\n").trim();
}

function provider(name, envKey, tasks, extra = {}) {
  const apiKey = env(envKey);
  return { name, envKey, tasks, enabled: Boolean(apiKey), apiKey, ...extra };
}

function env(name) {
  return globalThis.process?.env?.[name] ?? localEnv()[name];
}

let cachedLocalEnv;

function localEnv() {
  if (cachedLocalEnv) return cachedLocalEnv;
  cachedLocalEnv = {};
  if (!existsSync(".env")) return cachedLocalEnv;
  const lines = readFileSync(".env", "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim().replace(/^\uFEFF/, "");
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (key) cachedLocalEnv[key] = value;
  }
  return cachedLocalEnv;
}
