import path from "node:path";
import { promises as fs } from "node:fs";
import crypto from "node:crypto";

export class Scheduler {
  constructor({ workspaceDir, bus }) {
    this.file = path.join(workspaceDir, "jobs.json");
    this.bus = bus;
    this.timers = new Map();
  }

  async init() {
    this.jobs = await this.load();
    for (const job of this.jobs) this.arm(job);
  }

  async add({ cron, prompt, groupId }) {
    const job = { id: crypto.randomUUID(), cron, prompt, groupId, createdAt: new Date().toISOString(), enabled: true };
    this.jobs.push(job);
    await this.save();
    this.arm(job);
    return job;
  }

  async cancel(id) {
    this.jobs = this.jobs.map((job) => (job.id === id ? { ...job, enabled: false } : job));
    clearInterval(this.timers.get(id));
    this.timers.delete(id);
    await this.save();
  }

  async list() {
    return this.jobs;
  }

  async listText() {
    if (!this.jobs.length) return "Nenhum job cadastrado.";
    return this.jobs.map((job) => `${job.enabled ? "on " : "off"} ${job.id} | ${job.cron} | ${job.prompt}`).join("\n");
  }

  arm(job) {
    if (!job.enabled) return;
    const intervalMs = cronToInterval(job.cron);
    if (!intervalMs) return;
    clearInterval(this.timers.get(job.id));
    this.timers.set(job.id, setInterval(() => this.bus.emit("job:run", job), intervalMs));
  }

  async load() {
    try {
      return JSON.parse(await fs.readFile(this.file, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }

  async save() {
    await fs.writeFile(this.file, JSON.stringify(this.jobs, null, 2), "utf8");
  }
}

function cronToInterval(cron) {
  const every = cron.match(/^\*\/(\d+) \* \* \* \*$/);
  if (every) return Number(every[1]) * 60_000;
  if (cron === "@hourly") return 60 * 60_000;
  if (cron === "@daily") return 24 * 60 * 60_000;
  return null;
}
