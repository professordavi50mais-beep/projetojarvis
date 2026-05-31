import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import { MessageBus } from "./message-bus.js";
import { MemoryStore } from "./memory.js";
import { SecurityPolicy } from "./security.js";
import { SecretStore } from "./secrets.js";
import { Scheduler } from "./scheduler.js";
import { ProviderRouter } from "./providers.js";
import { createToolRegistry } from "../tools/registry.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export async function createAgent({ workspace = "default" } = {}) {
  const workspaceDir = path.join(rootDir, "workspaces", sanitizeName(workspace));
  await fs.mkdir(workspaceDir, { recursive: true });

  const soul = await fs.readFile(path.join(rootDir, "Soul.md"), "utf8");
  const bus = new MessageBus();
  const memory = new MemoryStore({ workspaceDir });
  const security = new SecurityPolicy({ workspaceDir });
  const secrets = new SecretStore({ workspaceDir });
  const scheduler = new Scheduler({ workspaceDir, bus });
  const providers = new ProviderRouter({ soul });
  const tools = createToolRegistry({ memory, security, secrets, scheduler, providers, bus, workspaceDir });

  await memory.init();
  await security.init();
  await scheduler.init();

  return new Agent({ workspace, workspaceDir, soul, bus, memory, security, secrets, scheduler, providers, tools });
}

class Agent {
  constructor(parts) {
    Object.assign(this, parts);
    this.runtimeRules = [];
    this.bus.on("job:run", async (job) => {
      await this.handleMessage({ channel: "scheduler", groupId: job.groupId ?? "system", userId: "scheduler", text: job.prompt });
    });
  }

  async handleMessage(message) {
    const text = message.text?.trim() ?? "";
    await this.memory.appendHistory(message.groupId, { role: "user", text, channel: message.channel, at: new Date().toISOString() });

    if (text === "/help") return this.help();
    if (text.startsWith("/rule ")) return this.handleRule(text);
    if (text.startsWith("/memory ")) return this.remember(message.groupId, text.slice(8).trim());
    if (text.startsWith("/forget ")) return this.forget(message.groupId, text.slice(8).trim());
    if (text.startsWith("/job ")) return this.handleJob(text, message);
    if (text.startsWith("/secret ")) return this.handleSecret(text);
    if (text.startsWith("/tool ")) return this.handleTool(text, message);

    const facts = await this.memory.readFacts(message.groupId);
    const response = await this.providers.complete({
      taskType: classifyTask(text),
      messages: [
        { role: "system", content: this.composeSystemPrompt(facts) },
        { role: "user", content: text }
      ]
    });

    await this.memory.appendHistory(message.groupId, { role: "assistant", text: response.text, provider: response.provider, at: new Date().toISOString() });
    return response;
  }

  composeSystemPrompt(facts) {
    return [
      this.soul,
      "## Runtime Rules",
      this.runtimeRules.length ? this.runtimeRules.map((rule) => `- ${rule}`).join("\n") : "- No runtime rules.",
      "## Group Memory",
      facts || "No saved facts."
    ].join("\n\n");
  }

  help() {
    return {
      text: [
        "Comandos:",
        "/memory <fato> - salva uma memoria do grupo",
        "/forget <termo> - remove memorias que contenham o termo",
        "/rule add <regra> - adiciona regra dinamica",
        "/rule list - lista regras dinamicas",
        "/rule clear - limpa regras dinamicas",
        "/job add <cron> :: <prompt> - agenda rotina",
        "/job list - lista rotinas",
        "/secret set <nome> <valor> - salva segredo criptografado",
        "/secret get <nome> - mostra se o segredo existe sem revelar valor",
        "/tool list - lista ferramentas"
      ].join("\n")
    };
  }

  handleRule(text) {
    const action = text.slice(6).trim();
    if (action.startsWith("add ")) {
      this.runtimeRules.push(action.slice(4).trim());
      return { text: "Regra dinamica adicionada." };
    }
    if (action === "list") return { text: this.runtimeRules.map((rule, i) => `${i + 1}. ${rule}`).join("\n") || "Sem regras dinamicas." };
    if (action === "clear") {
      this.runtimeRules = [];
      return { text: "Regras dinamicas limpas." };
    }
    return { text: "Uso: /rule add <texto>, /rule list ou /rule clear." };
  }

  async remember(groupId, fact) {
    await this.memory.storeFact(groupId, fact);
    return { text: "Memoria salva para este grupo." };
  }

  async forget(groupId, term) {
    const count = await this.memory.forgetFacts(groupId, term);
    return { text: `${count} memoria(s) removida(s).` };
  }

  async handleJob(text, message) {
    const body = text.slice(5).trim();
    if (body === "list") return { text: await this.scheduler.listText() };
    if (body.startsWith("cancel ")) {
      await this.scheduler.cancel(body.slice(7).trim());
      return { text: "Job cancelado se existia." };
    }
    if (body.startsWith("add ")) {
      const [cron, prompt] = body.slice(4).split("::").map((part) => part?.trim());
      if (!cron || !prompt) return { text: "Uso: /job add <cron> :: <prompt>" };
      const job = await this.scheduler.add({ cron, prompt, groupId: message.groupId });
      return { text: `Job criado: ${job.id}` };
    }
    return { text: "Uso: /job add, /job list ou /job cancel <id>." };
  }

  async handleSecret(text) {
    const body = text.slice(8).trim();
    if (body.startsWith("set ")) {
      const [name, ...valueParts] = body.slice(4).split(" ");
      await this.secrets.set(name, valueParts.join(" "));
      return { text: `Segredo ${name} salvo criptografado.` };
    }
    if (body.startsWith("get ")) {
      const value = await this.secrets.get(body.slice(4).trim());
      return { text: value ? "Segredo encontrado. O valor nao sera exibido no chat." : "Segredo nao encontrado." };
    }
    return { text: "Uso: /secret set <nome> <valor> ou /secret get <nome>." };
  }

  async handleTool(text, message) {
    const body = text.slice(6).trim();
    if (body === "list") return { text: this.tools.list().join("\n") };
    const [name, ...args] = body.split(" ");
    return this.tools.run(name, { args, message });
  }

  async doctor() {
    return {
      workspace: this.workspace,
      workspaceDir: this.workspaceDir,
      tools: this.tools.list(),
      providers: this.providers.available(),
      policy: await this.security.summary(),
      jobs: await this.scheduler.list()
    };
  }
}

function classifyTask(text) {
  if (/codigo|programa|erro|stack|bug|api|sql/i.test(text)) return "code";
  if (/resuma|resumo|youtube|podcast|url/i.test(text)) return "summarize";
  if (/rapido|curto|simples/i.test(text)) return "fast";
  return "general";
}

function sanitizeName(name) {
  return String(name).replace(/[^a-zA-Z0-9_.-]/g, "_");
}
