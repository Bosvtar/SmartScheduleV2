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

const safeRedis = {
  set: async (key: string, value: any): Promise<any> => {
    const client = await getUpstashClient();
    if (client) {
      try {
        return await client.set(key, value);
      } catch (e) {
        console.warn("Redis set error:", e);
      }
    }
    memoryStore.set(key, value);
    return "OK";
  },
  sadd: async (key: string, member: string): Promise<number> => {
    const client = await getUpstashClient();
    if (client) {
      try {
        return await client.sadd(key, member);
      } catch (e) {
        console.warn("Redis sadd error:", e);
      }
    }
    if (!memorySets.has(key)) memorySets.set(key, new Set());
    const set = memorySets.get(key)!;
    const sizeBefore = set.size;
    set.add(member);
    return set.size - sizeBefore;
  },
};

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

    const { deviceId, subscription, schedules, settings, timezone } = body || {};
    if (!deviceId || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ error: "Thiếu deviceId hoặc Push subscription hợp lệ" });
    }

    const device = {
      deviceId,
      subscription,
      schedules: Array.isArray(schedules) ? schedules : [],
      settings: settings || {},
      timezone: timezone || "Asia/Ho_Chi_Minh",
      updatedAt: new Date().toISOString(),
    };

    const deviceKey = `smartschedule:device:${deviceId}`;
    const deviceSetKey = "smartschedule:devices";

    await safeRedis.set(deviceKey, device);
    await safeRedis.sadd(deviceSetKey, deviceId);

    const client = await getUpstashClient();

    return res.status(200).json({
      ok: true,
      deviceId,
      scheduleCount: device.schedules.length,
      upstashConnected: Boolean(client),
    });
  } catch (error: any) {
    console.error("push-sync error:", error);
    return res.status(200).json({
      ok: true,
      warning: "Đồng bộ bộ nhớ tạm",
      error: error?.message,
    });
  }
}
