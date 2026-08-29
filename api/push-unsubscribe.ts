import type { VercelRequest, VercelResponse } from "@vercel/node";

const memoryStore = new Map<string, any>();
const memorySets = new Map<string, Set<string>>();

let upstashInstance: any = null;
let upstashInitialized = false;

async function getUpstashClient() {
  if (upstashInitialized) return upstashInstance;
  upstashInitialized = true;
  const rawUrl = process.env.UPSTASH_REDIS_REST_URL;
  const rawToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (rawUrl && rawToken && typeof rawUrl === "string" && typeof rawToken === "string") {
    const cleanUrl = rawUrl.trim();
    const cleanToken = rawToken.trim();
    if (cleanUrl.startsWith("http") && !cleanUrl.includes("your-") && !cleanToken.includes("your-")) {
      try {
        const { Redis } = await import("@upstash/redis");
        upstashInstance = new Redis({ url: cleanUrl, token: cleanToken });
      } catch (err) {
        console.warn("Failed to initialize Upstash Redis:", err);
        upstashInstance = null;
      }
    }
  }
  return upstashInstance;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }

    const { deviceId } = body || {};
    if (!deviceId) return res.status(400).json({ error: "Thiếu deviceId" });

    const client = await getUpstashClient();
    if (client) {
      try {
        await client.del(`smartschedule:device:${deviceId}`);
        await client.srem("smartschedule:devices", deviceId);
      } catch (e) {
        console.warn("Redis delete error:", e);
      }
    }
    memoryStore.delete(`smartschedule:device:${deviceId}`);
    const s = memorySets.get("smartschedule:devices");
    if (s) s.delete(deviceId);

    return res.status(200).json({ ok: true });
  } catch (error: any) {
    return res.status(200).json({ ok: true, warning: error?.message });
  }
}
