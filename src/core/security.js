import path from "node:path";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";

const defaultBlocklist = [
  "rm -rf /",
  "del /s /q c:\\",
  "format ",
  "shutdown ",
  "reboot",
  "diskpart",
  "mkfs",
  "git reset --hard"
];

export class SecurityPolicy {
  constructor({ workspaceDir }) {
    this.workspaceDir = workspaceDir;
    this.policyFile = path.join(workspaceDir, "security-policy.json");
  }

  async init() {
    try {
      this.policy = JSON.parse(await fs.readFile(this.policyFile, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      this.policy = {
        mode: "supervised",
        blocklist: defaultBlocklist,
        readonlyCommands: ["dir", "ls", "pwd", "type", "cat", "rg", "findstr", "git status", "git diff"]
      };
      await fs.writeFile(this.policyFile, JSON.stringify(this.policy, null, 2), "utf8");
    }
  }

  async summary() {
    return this.policy;
  }

  assess(command) {
    const normalized = command.toLowerCase();
    const blocked = this.policy.blocklist.find((item) => normalized.includes(item.toLowerCase()));
    if (blocked) return { allowed: false, reason: `Command blocked by policy: ${blocked}` };
    if (this.policy.mode === "autonomous") return { allowed: true, approvalRequired: false };
    const readonly = this.policy.readonlyCommands.some((prefix) => normalized.startsWith(prefix.toLowerCase()));
    if (this.policy.mode === "readonly" && !readonly) return { allowed: false, reason: "Readonly mode blocks write/execution commands." };
    return { allowed: true, approvalRequired: !readonly };
  }

  async runCommand(command, { approved = false } = {}) {
    const assessment = this.assess(command);
    if (!assessment.allowed) return { ok: false, text: assessment.reason };
    if (assessment.approvalRequired && !approved) {
      return { ok: false, approvalRequired: true, text: `Approval required before running: ${command}` };
    }
    return runShell(command);
  }
}

function runShell(command) {
  return new Promise((resolve) => {
    const child = spawn(command, { shell: true, windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("close", (code) => resolve({ ok: code === 0, code, text: stdout || stderr }));
  });
}
