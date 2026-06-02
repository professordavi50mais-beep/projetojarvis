import { createAgent } from "../src/core/agent.js";

let cachedAgent;

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!cachedAgent) cachedAgent = await createAgent({ workspace: "vercel" });
    const status = await cachedAgent.doctor();
    return res.status(200).json(status);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
