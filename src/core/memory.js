import path from "node:path";
import { promises as fs } from "node:fs";

export class MemoryStore {
  constructor({ workspaceDir }) {
    this.workspaceDir = workspaceDir;
  }

  async init() {
    await fs.mkdir(path.join(this.workspaceDir, "groups"), { recursive: true });
  }

  async storeFact(groupId, fact) {
    const file = await this.groupFile(groupId, "MEMORY.md");
    const line = `- ${new Date().toISOString()}: ${fact}\n`;
    await fs.appendFile(file, line, "utf8");
  }

  async readFacts(groupId) {
    const file = await this.groupFile(groupId, "MEMORY.md");
    return readIfExists(file);
  }

  async forgetFacts(groupId, term) {
    const file = await this.groupFile(groupId, "MEMORY.md");
    const current = await readIfExists(file);
    const lines = current.split(/\r?\n/);
    const kept = lines.filter((line) => !line.toLowerCase().includes(term.toLowerCase()));
    await fs.writeFile(file, kept.join("\n"), "utf8");
    return lines.length - kept.length;
  }

  async appendHistory(groupId, entry) {
    const file = await this.groupFile(groupId, "history.log");
    await fs.appendFile(file, `${JSON.stringify(entry)}\n`, "utf8");
  }

  async searchHistory(groupId, term) {
    const file = await this.groupFile(groupId, "history.log");
    const log = await readIfExists(file);
    return log.split(/\r?\n/).filter((line) => line.toLowerCase().includes(term.toLowerCase()));
  }

  async compactHistory(groupId, maxLines = 200) {
    const file = await this.groupFile(groupId, "history.log");
    const lines = (await readIfExists(file)).split(/\r?\n/).filter(Boolean);
    if (lines.length <= maxLines) return { compacted: false, lines: lines.length };
    const kept = lines.slice(-maxLines);
    await fs.writeFile(file, kept.join("\n") + "\n", "utf8");
    await this.storeFact(groupId, `Historico compactado automaticamente; ${lines.length - kept.length} entradas antigas removidas do log detalhado.`);
    return { compacted: true, lines: kept.length };
  }

  async groupFile(groupId, name) {
    const groupDir = path.join(this.workspaceDir, "groups", sanitizeName(groupId));
    await fs.mkdir(groupDir, { recursive: true });
    return path.join(groupDir, name);
  }
}

async function readIfExists(file) {
  try {
    return await fs.readFile(file, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
}

function sanitizeName(name) {
  return String(name ?? "default").replace(/[^a-zA-Z0-9_.-]/g, "_");
}
