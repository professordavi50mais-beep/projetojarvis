#!/usr/bin/env node
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { existsSync, readFileSync } from "node:fs";
import { createAgent } from "./core/agent.js";
import { startDashboard } from "./channels/dashboard.js";

loadDotEnv();

const command = process.argv[2] ?? "help";
const workspace = process.argv[3] ?? "default";

async function main() {
  if (command === "doctor") {
    const agent = await createAgent({ workspace });
    const report = await agent.doctor();
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  if (command === "dashboard") {
    const agent = await createAgent({ workspace });
    const server = await startDashboard({ agent, port: Number(process.env.PORT ?? 8787) });
    console.log(`ProfDavi50+ dashboard: http://localhost:${server.port}`);
    return;
  }

  if (command === "chat") {
    const agent = await createAgent({ workspace });
    const rl = readline.createInterface({ input, output });
    console.log("ProfDavi50+ chat. Use /help, /exit, /rule add <texto>, /memory <texto>.");
    for (;;) {
      const text = await rl.question("> ");
      if (text.trim() === "/exit") break;
      const response = await agent.handleMessage({ channel: "cli", groupId: "local", userId: "owner", text });
      console.log(response.text);
    }
    rl.close();
    return;
  }

  console.log("Usage:");
  console.log("  node src/cli.js doctor [workspace]");
  console.log("  node src/cli.js chat [workspace]");
  console.log("  node src/cli.js dashboard [workspace]");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

function loadDotEnv() {
  if (!existsSync(".env")) return;
  const lines = readFileSync(".env", "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}
