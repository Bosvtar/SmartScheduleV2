import type { VercelRequest, VercelResponse } from "@vercel/node";

const DEFAULT_VAPID_PUBLIC_KEY = "BGqsbtamMJRqSSfWHyXzzH2y9iXUBiyHGLUpw4pl7jcF7OO8Raw0d9aHoUAYtb-98MHERF0xgiDMB_atgyt0kPs";
const DEFAULT_VAPID_PRIVATE_KEY = "ZD_48yMiorSMHHYa5trlNfoiNBy8V5LMdZrytD89FiI";
const DEFAULT_VAPID_SUBJECT = "mailto:smartschedule.app@gmail.com";

function isValidBase64Key(key: string | undefined, minLen = 30): boolean {
  if (!key || typeof key !== "string") return false;
  const trimmed = key.trim();
  if (trimmed.includes("your_") || trimmed.includes("replace_") || trimmed.includes("...") || trimmed.length < minLen) {
    return false;
  }
  return true;
}

function getVapidPublicKey() {
  const envPub = process.env.VITE_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
  if (isValidBase64Key(envPub, 60)) return envPub!.trim();
  return DEFAULT_VAPID_PUBLIC_KEY;
}

function getVapidPrivateKey() {
  const envPriv = process.env.VAPID_PRIVATE_KEY;
  if (isValidBase64Key(envPriv, 30)) return envPriv!.trim();
  return DEFAULT_VAPID_PRIVATE_KEY;
}

function getVapidSubject() {
  const envSub = process.env.VAPID_SUBJECT;
  if (envSub && envSub.includes("@") && !envSub.includes("your_")) return envSub.trim();
  return DEFAULT_VAPID_SUBJECT;
}

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

let webPushInstance: any = null;
async function getWebPush() {
  if (webPushInstance) return webPushInstance;
  try {
    const mod = await import("web-push");
    webPushInstance = mod.default || mod;
  } catch (e) {
    console.warn("Failed to load web-push module:", e);
    webPushInstance = null;
  }
  return webPushInstance;
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

    const { deviceId, subscription } = body || {};
    let targetSub = subscription;

    if (!targetSub && deviceId) {
      const client = await getUpstashClient();
      if (client) {
        try {
          const device: any = await client.get(`smartschedule:device:${deviceId}`);
          if (device?.subscription) {
            targetSub = device.subscription;
          }
        } catch (e) {
          console.warn("Redis fetch error in push-test:", e);
        }
      }
    }

    if (!targetSub?.endpoint || !targetSub?.keys?.p256dh || !targetSub?.keys?.auth) {
      return res.status(400).json({ error: "Chưa tìm thấy thông tin đăng ký Push của thiết bị. Hãy bấm Bật Web Push trước." });
    }

    const wp = await getWebPush();
    if (!wp) {
      return res.status(500).json({ error: "Thư viện web-push chưa sẵn sàng trên máy chủ." });
    }

    const activePub = getVapidPublicKey();
    const activePriv = getVapidPrivateKey();
    const activeSub = getVapidSubject();

    try {
      wp.setVapidDetails(activeSub, activePub, activePriv);
    } catch (vErr: any) {
      console.warn("setVapidDetails warning:", vErr?.message);
    }

    const payload = {
      title: "🔔 SmartSchedule - Thông báo thử",
      body: "Chúc mừng! Web Push trên Vercel đang hoạt động rất tốt.",
      url: "/",
    };

    await wp.sendNotification(targetSub, JSON.stringify(payload), { TTL: 120 });
    return res.status(200).json({ ok: true, message: "Đã gửi thông báo thử thành công!" });
  } catch (error: any) {
    const status = error?.statusCode || error?.status || 500;
    console.error("push-test error:", error);
    const bodyMsg = typeof error?.body === "string" ? error.body : (error?.message || "Không thể gửi Push thử");
    return res.status(status).json({
      error: `Lỗi Web Push (${status}): ${bodyMsg}`,
      statusCode: status,
      details: error?.body || error?.message,
    });
  }
}
