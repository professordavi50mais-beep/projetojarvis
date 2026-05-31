# ProfDavi50+ Agent

ProfDavi50+ is a local-first AI agent framework scaffold built from the ingredient list supplied in the workspace.

It includes:

- `Soul.md` personality and behavior file
- isolated workspaces and per-group memory
- dynamic behavior rules
- approval gates and command blocklist
- encrypted secret store using `chacha20-poly1305`
- HTTP dashboard and webhook endpoint
- simple cron/routine manager
- message bus architecture
- provider router with model selection and failover
- tool registry for memory, shell, documents, summaries, jobs, browser, Google Workspace, WhatsApp and MCP adapters

## Quick Start

```powershell
cd jarvs-agent
node src/cli.js doctor
node src/cli.js chat
node src/cli.js dashboard
```

Telegram bot:

```powershell
cd "C:\Users\Davi Santa Bárbara\Projetos\jarvs-agent"
node src/cli.js telegram
```

Set `TELEGRAM_BOT_TOKEN` in `.env` first. The bot uses long polling, so it works locally without a public webhook URL.
Set `TELEGRAM_ALLOWED_USER_IDS` to restrict the bot to specific Telegram users, separated by commas.

Dashboard:

```text
http://localhost:8787
```

## Layout

```text
Soul.md                         Personality and operating style
src/cli.js                      CLI entry point
src/core/agent.js               Main orchestrator
src/core/memory.js              Two-layer and per-group memory
src/core/security.js            Approval gates and command blocklist
src/core/secrets.js             Encrypted secret store
src/core/scheduler.js           Cron-like routines
src/core/providers.js           Multi-provider routing/failover
src/core/message-bus.js         Internal event bus
src/channels/dashboard.js       Web dashboard and webhook API
src/tools/registry.js           Tool registry and built-in tools
workspaces/default/             Default isolated workspace
docs/ARCHITECTURE.md            Implementation notes mapped to the ingredient list
```

## Environment

Optional provider keys:

```powershell
$env:OPENAI_API_KEY="..."
$env:OPENAI_MODEL="gpt-4.1-mini"
$env:ANTHROPIC_API_KEY="..."
$env:GOOGLE_API_KEY="..."
$env:OPENROUTER_API_KEY="..."
```

ProfDavi50+ runs without keys in `mock` mode, which is useful for testing the framework flow.

## Local LLM With Ollama

ProfDavi50+ tries Ollama automatically before falling back to `mock`.

Install Ollama, then run:

```powershell
ollama pull llama3.2
ollama serve
```

In another terminal:

```powershell
cd "C:\Users\Davi Santa Bárbara\Projetos\jarvs-agent"
node src/cli.js dashboard
```

Optional model override:

```powershell
$env:OLLAMA_MODEL="mistral"
```

To make ProfDavi50+ answer real questions with OpenAI:

```powershell
cd "C:\Users\Davi Santa Bárbara\Projetos\jarvs-agent"
$env:OPENAI_API_KEY="sua-chave-aqui"
node src/cli.js dashboard
```
