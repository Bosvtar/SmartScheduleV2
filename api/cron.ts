import type { VercelRequest, VercelResponse } from "@vercel/node";

// In-memory fallback if Upstash is not configured
const memoryStore = new Map<string, any>();
const memorySets = new Map<string, Set<string>>();

const DEFAULT_VAPID_PUBLIC_KEY = "BEgl5nFnHZId0neRHh_opBKRNuOWO-bST34Dv5dNY9kPtjkxS6Tr0RNe5EHlhiuyTQ1U_jZCpEBprwjvnH-cG34";
const DEFAULT_VAPID_PRIVATE_KEY = "E80fL0wqI0kzSNqMK_Xh6n-QawObczy1xzo3h20hvvw";
const DEFAULT_VAPID_SUBJECT = "mailto:smartschedule@app.internal";

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

const safeRedis = {
  get: async <T = any>(key: string): Promise<T | null> => {
    const client = await getUpstashClient();
    if (client) {
      try {
        const res = await client.get(key);
        return res !== undefined ? res : null;
      } catch (e) {
        console.warn("Redis get error:", e);
      }
    }
    const val = memoryStore.get(key);
    return val !== undefined ? val : null;
  },
  set: async (key: string, value: any, options?: { nx?: boolean; ex?: number }): Promise<any> => {
    const client = await getUpstashClient();
    if (client) {
      try {
        return await client.set(key, value, options);
      } catch (e) {
        console.warn("Redis set error:", e);
      }
    }
    if (options?.nx && memoryStore.has(key)) return null;
    memoryStore.set(key, value);
    return "OK";
  },
  del: async (key: string): Promise<number> => {
    const client = await getUpstashClient();
    if (client) {
      try {
        return await client.del(key);
      } catch (e) {
        console.warn("Redis del error:", e);
      }
    }
    return memoryStore.delete(key) ? 1 : 0;
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
  srem: async (key: string, member: string): Promise<number> => {
    const client = await getUpstashClient();
    if (client) {
      try {
        return await client.srem(key, member);
      } catch (e) {
        console.warn("Redis srem error:", e);
      }
    }
    const set = memorySets.get(key);
    if (!set) return 0;
    return set.delete(member) ? 1 : 0;
  },
  smembers: async <T = string>(key: string): Promise<T[]> => {
    const client = await getUpstashClient();
    if (client) {
      try {
        const res = await client.smembers(key);
        return Array.isArray(res) ? (res as unknown as T[]) : [];
      } catch (e) {
        console.warn("Redis smembers error:", e);
      }
    }
    const set = memorySets.get(key);
    return set ? (Array.from(set) as unknown as T[]) : [];
  },
};

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

async function sendPushNotification(subscription: any, payload: any) {
  const wp = await getWebPush();
  if (!wp) throw new Error("web-push module not available");
  const pub = getVapidPublicKey();
  const priv = getVapidPrivateKey();
  const sub = getVapidSubject();
  try {
    wp.setVapidDetails(sub, pub, priv);
  } catch (e) {
    console.warn("setVapidDetails warning:", e);
  }
  return wp.sendNotification(subscription, JSON.stringify(payload), { TTL: 120 });
}

function getVietnamNow(date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
      weekday: "long",
    }).formatToParts(date);
    const pick = (type: string) => parts.find(p => p.type === type)?.value || "";
    const year = pick("year"), month = pick("month"), day = pick("day");
    const hour = pick("hour"), minute = pick("minute"), second = pick("second");
    const weekdayEn = pick("weekday").toLowerCase();
    const dayMap: Record<string, string> = {
      monday: "Thứ 2", tuesday: "Thứ 3", wednesday: "Thứ 4", thursday: "Thứ 5",
      friday: "Thứ 6", saturday: "Thứ 7", sunday: "Chủ Nhật"
    };
    return {
      dateStr: `${day}/${month}/${year}`,
      timeStr: `${hour}:${minute}`,
      totalMinutes: Number(hour) * 60 + Number(minute),
      dayOfWeek: dayMap[weekdayEn] || "Thứ 2",
    };
  } catch {
    const d = new Date();
    return {
      dateStr: `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`,
      timeStr: `${d.getHours()}:${d.getMinutes()}`,
      totalMinutes: d.getHours() * 60 + d.getMinutes(),
      dayOfWeek: "Thứ 2",
    };
  }
}

function toMinutes(hhmm: string) {
  const [h, m] = String(hhmm || "").split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : NaN;
}

function tomorrowDateStr(now = new Date()) {
  const vn = getVietnamNow(now);
  const [dd, mm, yyyy] = vn.dateStr.split("/").map(Number);
  const utc = new Date(Date.UTC(yyyy, mm - 1, dd) + 86400000);
  const d = String(utc.getUTCDate()).padStart(2, "0");
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const y = utc.getUTCFullYear();
  return `${d}/${m}/${y}`;
}

function tomorrowDay(now = new Date()) {
  return getVietnamNow(new Date(now.getTime() + 86400000)).dayOfWeek;
}

function isAuthorized(req: VercelRequest) {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (req.headers["x-vercel-cron"] === "1") return true;
  if (!secret || secret.startsWith("replace_with") || secret.startsWith("your_") || secret.length < 8) {
    return true;
  }
  const auth = req.headers.authorization || "";
  const supplied = Array.isArray(req.query?.secret) ? req.query.secret[0] : req.query?.secret;
  return auth === `Bearer ${secret}` || supplied === secret;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  let checked = 0;
  let sent = 0;
  let errors = 0;
  const now = getVietnamNow();

  try {
    const deviceSetKey = "smartschedule:devices";
    const deviceKey = (id: string) => `smartschedule:device:${id}`;

    let ids: string[] = [];
    try {
      ids = await safeRedis.smembers<string>(deviceSetKey);
    } catch (e) {
      console.warn("Failed to get devices set:", e);
      ids = [];
    }

    for (const deviceId of ids || []) {
      try {
        const device = await safeRedis.get<any>(deviceKey(deviceId));
        if (!device?.subscription) {
          await safeRedis.srem(deviceSetKey, deviceId).catch(() => {});
          continue;
        }
        checked++;
        const settings = device.settings || {};
        if (!settings.enabled) continue;

        const due: { key: string; title: string; body: string }[] = [];
        for (const item of device.schedules || []) {
          const isToday = item.date ? item.date === now.dateStr : item.dayOfWeek === now.dayOfWeek;
          if (!isToday) continue;
          const start = toMinutes(item.startTime);
          for (const offset of settings.notifyMinutesBefore || [15]) {
            const target = start - Number(offset);
            if (Number.isFinite(target) && now.totalMinutes >= target && now.totalMinutes <= target + 5) {
              due.push({
                key: `smartschedule:sent:${deviceId}:${now.dateStr}:${item.id}:before:${offset}`,
                title: `🔔 Nhắc lịch dạy: ${item.subject || "Buổi dạy"}`,
                body: `${item.className ? `Lớp ${item.className}` : "Buổi dạy"}${item.location ? ` • ${item.location}` : ""} • Bắt đầu lúc ${item.startTime} (${offset} phút nữa)${item.lessonName ? ` • ${item.lessonName}` : ""}`,
              });
            }
          }
        }

        if (settings.dayBeforeReminder && settings.dayBeforeReminderTime) {
          const [remH, remM] = String(settings.dayBeforeReminderTime).split(":").map(Number);
          const remMinutes = Number.isFinite(remH) && Number.isFinite(remM) ? remH * 60 + remM : NaN;
          if (Number.isFinite(remMinutes) && now.totalMinutes >= remMinutes && now.totalMinutes <= remMinutes + 15) {
            const tDate = tomorrowDateStr();
            const tDay = tomorrowDay();
            const sessions = (device.schedules || [])
              .filter((i: any) => (i.date ? i.date === tDate : i.dayOfWeek === tDay))
              .sort((a: any, b: any) => String(a.startTime).localeCompare(String(b.startTime)));
            if (sessions.length) {
              const preview = sessions.slice(0, 2).map((s: any) => `${s.subject} (${s.startTime})`).join(", ");
              due.push({
                key: `smartschedule:sent:${deviceId}:${now.dateStr}:day-before`,
                title: `📅 Lịch dạy ngày mai (${tDay})`,
                body: `Bạn có ${sessions.length} buổi dạy: ${preview}${sessions.length > 2 ? ` và ${sessions.length - 2} buổi khác` : ""}.`,
              });
            }
          }
        }

        for (const job of due) {
          const claimed = await safeRedis.set(job.key, "1", { nx: true, ex: 172800 }).catch(() => null);
          if (!claimed) continue;
          try {
            await sendPushNotification(device.subscription, { title: job.title, body: job.body, url: "/" });
            sent++;
          } catch (pushErr: any) {
            errors++;
            await safeRedis.del(job.key).catch(() => {});
            const code = pushErr?.statusCode || pushErr?.status;
            if (code === 404 || code === 410) {
              await safeRedis.del(deviceKey(deviceId)).catch(() => {});
              await safeRedis.srem(deviceSetKey, deviceId).catch(() => {});
              break;
            }
            console.warn("Push error for device:", deviceId, pushErr?.message || pushErr);
          }
        }
      } catch (deviceErr) {
        console.warn("Device loop error:", deviceId, deviceErr);
      }
    }

    return res.status(200).json({ ok: true, now, checked, sent, errors });
  } catch (globalErr: any) {
    console.error("Cron handler caught error:", globalErr);
    return res.status(200).json({
      ok: false,
      warning: "Handled error",
      error: globalErr?.message || String(globalErr),
      checked,
      sent,
      errors,
    });
  }
}
