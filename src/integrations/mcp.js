export class McpRegistry {
  constructor() {
    this.servers = [];
  }

  add(server) {
    this.servers.push(server);
  }

  list() {
    return this.servers;
  }
}
