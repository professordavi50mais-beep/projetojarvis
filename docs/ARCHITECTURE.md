# Jarvs Architecture

This scaffold maps the supplied ingredient list into a modular local agent.

## Implemented Core

- Soul personality file: `Soul.md`
- Per-group memory: `workspaces/<name>/groups/<groupId>/MEMORY.md`
- Two-layer memory: quick facts in `MEMORY.md`, searchable JSONL history in `history.log`
- Session auto-compaction: `memory.compact` tool
- Dynamic behavior rules: `/rule add`, `/rule list`, `/rule clear`
- Execution approval gates: `SecurityPolicy.assess()` and `shell.run`
- Command blocklist: `security-policy.json`
- Encrypted secret store: `SecretStore` with `chacha20-poly1305`
- Web dashboard: `src/channels/dashboard.js`
- Webhook triggers: `POST /webhook`
- Cron scheduling: `Scheduler` with `@hourly`, `@daily`, and `*/N * * * *`
- Message bus: `MessageBus`
- Workspace isolation: `workspaces/<name>`
- Provider routing/failover: `ProviderRouter`
- Tool registry: `src/tools/registry.js`

## Extension Points

- WhatsApp: `src/integrations/whatsapp.js`
- MCP: `src/integrations/mcp.js`
- Browser automation: `browser.open` tool stub
- Google Workspace: `google.workspace` tool stub
- Document knowledge base: `document.query` tool stub
- URL/video/podcast summarizer: `summarizer.url` tool stub

## Recommended Next Build Steps

1. Connect a real model provider in `src/core/providers.js`.
2. Add a persistent database adapter: SQLite for development and PostgreSQL for production.
3. Replace simple cron intervals with a full cron parser.
4. Add a document ingestion pipeline for PDF, Office, CSV and embeddings.
5. Implement WhatsApp using Meta Cloud API for production or Evolution API/Baileys for local automation.
6. Add MCP client support for stdio and HTTP transports.
7. Add UI pages for memory, jobs, secrets status and tool runs.

## Security Defaults

Jarvs starts in `supervised` mode. Read-only commands are allowed; other shell commands require approval. Dangerous commands are blocked before approval.
