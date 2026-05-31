export class TelegramIntegration {
  constructor({ agent, token, pollIntervalMs = 1200 }) {
    if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
    this.agent = agent;
    this.token = token;
    this.pollIntervalMs = pollIntervalMs;
    this.baseUrl = `https://api.telegram.org/bot${token}`;
    this.offset = 0;
    this.running = false;
  }

  async start() {
    const me = await this.call("getMe");
    if (!me.ok) throw new Error(`Telegram getMe failed: ${me.description ?? "unknown error"}`);

    await this.call("deleteWebhook", { drop_pending_updates: false });
    this.running = true;
    console.log(`Telegram bot connected: @${me.result.username}`);

    while (this.running) {
      await this.pollOnce();
      await sleep(this.pollIntervalMs);
    }
  }

  stop() {
    this.running = false;
  }

  async pollOnce() {
    const payload = await this.call("getUpdates", {
      offset: this.offset,
      timeout: 20,
      allowed_updates: ["message"]
    });

    if (!payload.ok) {
      console.error(`Telegram getUpdates failed: ${payload.description ?? "unknown error"}`);
      return;
    }

    for (const update of payload.result ?? []) {
      this.offset = update.update_id + 1;
      await this.handleUpdate(update);
    }
  }

  async handleUpdate(update) {
    const message = update.message;
    const text = message?.text?.trim();
    const chatId = message?.chat?.id;
    if (!chatId || !text) return;

    if (text === "/start") {
      await this.sendMessage(chatId, "Ola, eu sou o ProfDavi50+. Pode me enviar uma pergunta por aqui.");
      return;
    }

    await this.sendChatAction(chatId, "typing");
    const response = await this.agent.handleMessage({
      channel: "telegram",
      groupId: `telegram-${chatId}`,
      userId: String(message.from?.id ?? chatId),
      text
    });
    await this.sendMessage(chatId, response.text);
  }

  async sendMessage(chatId, text) {
    const chunks = splitTelegramText(text);
    for (const chunk of chunks) {
      await this.call("sendMessage", {
        chat_id: chatId,
        text: chunk,
        disable_web_page_preview: true
      });
    }
  }

  async sendChatAction(chatId, action) {
    await this.call("sendChatAction", { chat_id: chatId, action });
  }

  async call(method, body = {}) {
    const response = await fetch(`${this.baseUrl}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    return response.json();
  }
}

function splitTelegramText(text) {
  const value = String(text ?? "");
  const max = 3900;
  if (value.length <= max) return [value || "Sem resposta."];
  const chunks = [];
  for (let index = 0; index < value.length; index += max) {
    chunks.push(value.slice(index, index + max));
  }
  return chunks;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
