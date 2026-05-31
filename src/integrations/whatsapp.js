export class WhatsAppIntegration {
  constructor({ agent }) {
    this.agent = agent;
  }

  async receiveWebhook(payload) {
    return this.agent.handleMessage({
      channel: "whatsapp",
      groupId: payload.groupId ?? payload.from ?? "whatsapp",
      userId: payload.sender ?? payload.from ?? "unknown",
      text: payload.text ?? ""
    });
  }

  async sendMessage() {
    throw new Error("WhatsApp provider not configured. Connect Meta Cloud API, Evolution API or Baileys here.");
  }
}
