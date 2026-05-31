import { promises as fs } from "node:fs";
import path from "node:path";

export function createToolRegistry(deps) {
  const tools = new Map();
  const register = (name, description, run) => tools.set(name, { name, description, run });

  register("memory.search", "Search this group's history.", async ({ args, message }) => {
    const rows = await deps.memory.searchHistory(message.groupId, args.join(" "));
    return { text: rows.slice(-20).join("\n") || "Nada encontrado." };
  });

  register("memory.compact", "Compact old session history.", async ({ message }) => {
    const result = await deps.memory.compactHistory(message.groupId);
    return { text: JSON.stringify(result) };
  });

  register("shell.run", "Run a shell command through approval gates.", async ({ args }) => {
    const command = args.join(" ");
    const result = await deps.security.runCommand(command);
    return { text: result.text, approvalRequired: result.approvalRequired };
  });

  register("document.query", "Placeholder for document upload/query RAG.", async () => {
    return { text: "Document query stub pronto. Conecte um parser de PDF/Office e um indice vetorial em src/tools/registry.js." };
  });

  register("summarizer.url", "Placeholder URL/video/podcast summarizer.", async ({ args }) => {
    return { text: `Summarizer stub recebeu: ${args.join(" ")}. Conecte fetch/transcricao aqui.` };
  });

  register("browser.open", "Placeholder browser automation adapter.", async ({ args }) => {
    return { text: `Browser automation stub para: ${args.join(" ")}. Recomendado conectar Playwright.` };
  });

  register("google.workspace", "Placeholder Google Workspace suite.", async () => {
    return { text: "Google Workspace stub. Conecte OAuth e APIs Gmail/Calendar/Docs/Sheets/Slides." };
  });

  register("whatsapp.send", "Placeholder WhatsApp integration.", async ({ args }) => {
    return { text: `WhatsApp stub pronto para enviar: ${args.join(" ")}. Conecte Evolution API, Meta Cloud API ou Baileys.` };
  });

  register("mcp.list", "Placeholder MCP client registry.", async () => {
    return { text: "MCP stub. Adicione clientes MCP por stdio/http e exponha ferramentas no registry." };
  });

  register("workspace.files", "List files in current isolated workspace.", async () => {
    const files = await listFiles(deps.workspaceDir);
    return { text: files.join("\n") };
  });

  return {
    list: () => [...tools.values()].map((tool) => `${tool.name} - ${tool.description}`),
    run: async (name, input) => {
      const tool = tools.get(name);
      if (!tool) return { text: `Ferramenta nao encontrada: ${name}` };
      return tool.run(input);
    }
  };
}

async function listFiles(root) {
  const out = [];
  async function walk(dir) {
    for (const item of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, item.name);
      out.push(path.relative(root, full));
      if (item.isDirectory()) await walk(full);
    }
  }
  await walk(root);
  return out;
}
