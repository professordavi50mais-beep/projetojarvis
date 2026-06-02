import { createAgent } from "../src/core/agent.js";

let cachedAgent;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = await readBody(req);
    const agent = await getAgent();
    const response = await agent.handleMessage({
      channel: "vercel",
      groupId: body.groupId ?? "web",
      userId: body.userId ?? "web",
      text: body.text ?? ""
    });
    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

async function getAgent() {
  if (!cachedAgent) cachedAgent = await createAgent({ workspace: "vercel" });
  return cachedAgent;
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}
