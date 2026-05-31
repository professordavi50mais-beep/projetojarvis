export class MessageBus {
  constructor() {
    this.handlers = new Map();
    this.events = [];
  }

  on(type, handler) {
    const handlers = this.handlers.get(type) ?? [];
    handlers.push(handler);
    this.handlers.set(type, handlers);
  }

  async emit(type, payload) {
    const event = { type, payload, at: new Date().toISOString() };
    this.events.push(event);
    for (const handler of this.handlers.get(type) ?? []) {
      await handler(payload, event);
    }
  }

  recent(limit = 50) {
    return this.events.slice(-limit);
  }
}
