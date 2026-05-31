import crypto from "node:crypto";
import path from "node:path";
import { promises as fs } from "node:fs";

export class SecretStore {
  constructor({ workspaceDir }) {
    this.file = path.join(workspaceDir, "secrets.enc");
    this.keyFile = path.join(workspaceDir, "secrets.key");
  }

  async set(name, value) {
    const secrets = await this.readAll();
    secrets[name] = value;
    await this.writeAll(secrets);
  }

  async get(name) {
    const secrets = await this.readAll();
    return secrets[name];
  }

  async readAll() {
    const key = await this.key();
    try {
      const payload = JSON.parse(await fs.readFile(this.file, "utf8"));
      const decipher = crypto.createDecipheriv("chacha20-poly1305", key, Buffer.from(payload.nonce, "base64"), {
        authTagLength: 16
      });
      decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
      const clear = Buffer.concat([decipher.update(Buffer.from(payload.data, "base64")), decipher.final()]);
      return JSON.parse(clear.toString("utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return {};
      throw error;
    }
  }

  async writeAll(secrets) {
    const key = await this.key();
    const nonce = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("chacha20-poly1305", key, nonce, { authTagLength: 16 });
    const data = Buffer.concat([cipher.update(JSON.stringify(secrets), "utf8"), cipher.final()]);
    const payload = {
      alg: "chacha20-poly1305",
      nonce: nonce.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      data: data.toString("base64")
    };
    await fs.writeFile(this.file, JSON.stringify(payload, null, 2), "utf8");
  }

  async key() {
    if (process.env.JARVS_SECRET_KEY) return crypto.createHash("sha256").update(process.env.JARVS_SECRET_KEY).digest();
    try {
      return Buffer.from(await fs.readFile(this.keyFile, "utf8"), "base64");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      const key = crypto.randomBytes(32);
      await fs.writeFile(this.keyFile, key.toString("base64"), "utf8");
      return key;
    }
  }
}
