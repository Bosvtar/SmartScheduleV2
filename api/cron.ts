import type { VercelRequest, VercelResponse } from "@vercel/node";

// In-memory fallback if Upstash is not configured
const memoryStore = new Map<string, any>();
const memorySets = new Map<string, Set<string>>();

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
  return wp.sendNotification(subscription, JSON.stringify(payload), {
    TTL: 86400,
    urgency: "high",
    topic: "smartschedule-reminder"
  });
}

function normalizeDayOfWeek(day: string): string {
  if (!day) return "";
  const clean = day.trim().toLowerCase().replace(/\s+/g, " ");
  if (clean.includes("2") || clean.includes("hai") || clean.includes("mon")) return "Thứ 2";
  if (clean.includes("3") || clean.includes("ba") || clean.includes("tue")) return "Thứ 3";
  if (clean.includes("4") || clean.includes("tư") || clean.includes("tu") || clean.includes("bốn") || clean.includes("bon") || clean.includes("wed")) return "Thứ 4";
  if (clean.includes("5") || clean.includes("năm") || clean.includes("nam") || clean.includes("thu")) return "Thứ 5";
  if (clean.includes("6") || clean.includes("sáu") || clean.includes("sau") || clean.includes("fri")) return "Thứ 6";
  if (clean.includes("7") || clean.includes("bảy") || clean.includes("bay") || clean.includes("sat")) return "Thứ 7";
  if (clean.includes("nhật") || clean.includes("nhat") || clean.includes("cn") || clean.includes("sun")) return "Chủ Nhật";
  return day.trim();
}

function normalizeDateStr(dateStr?: string): string {
  if (!dateStr) return "";
  const parts = dateStr.trim().split(/[\/\-\.]/);
  if (parts.length === 3) {
    const d = parts[0].padStart(2, "0");
    const m = parts[1].padStart(2, "0");
    const y = parts[2];
    return `${d}/${m}/${y}`;
  }
  return dateStr.trim();
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
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const hour = String(d.getHours()).padStart(2, "0");
    const minute = String(d.getMinutes()).padStart(2, "0");
    return {
      dateStr: `${day}/${month}/${year}`,
      timeStr: `${hour}:${minute}`,
      totalMinutes: d.getHours() * 60 + d.getMinutes(),
      dayOfWeek: "Thứ 2",
    };
  }
}

function toMinutes(raw: string) {
  if (!raw) return NaN;
  const clean = String(raw).trim().replace(/h/i, ":");
  const parts = clean.split(":").map(p => parseInt(p.trim(), 10));
  if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
    return parts[0] * 60 + parts[1];
  }
  return NaN;
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
        const matchedTodaySessions: any[] = [];

        for (const item of device.schedules || []) {
          const itemDateNorm = normalizeDateStr(item.date);
          const itemDayNorm = normalizeDayOfWeek(item.dayOfWeek);
          const nowDayNorm = normalizeDayOfWeek(now.dayOfWeek);

          // Buổi dạy hôm nay nếu: Có ngày trùng ngày hôm nay, hoặc không có ngày/ngày cũ nhưng thứ trong tuần khớp
          const isToday = itemDateNorm ? (itemDateNorm === now.dateStr) : (itemDayNorm === nowDayNorm);
          if (!isToday) continue;

          matchedTodaySessions.push(item);
          const start = toMinutes(item.startTime);
          if (!Number.isFinite(start)) continue;

          for (const offset of (settings.notifyMinutesBefore || [15])) {
            const target = start - Number(offset);
            // Cửa sổ gửi thông báo: Từ thời điểm cần nhắc (start - offset) cho đến khi bắt đầu hoặc trễ tối đa 15 phút
            const windowEnd = Math.min(start + 5, target + 20);
            if (Number.isFinite(target) && now.totalMinutes >= target && now.totalMinutes <= windowEnd) {
              due.push({
                key: `smartschedule:sent:${deviceId}:${now.dateStr}:${item.id}:before:${offset}`,
                title: `🔔 Nhắc lịch dạy: ${item.subject || "Buổi dạy"}`,
                body: `${item.className ? `Lớp ${item.className}` : "Buổi dạy"}${item.location ? ` • ${item.location}` : ""} • Bắt đầu lúc ${item.startTime} (${offset} phút nữa)${item.lessonName ? ` • ${item.lessonName}` : ""}`,
              });
            }
          }
        }

        if (settings.dayBeforeReminder && settings.dayBeforeReminderTime) {
          const remMinutes = toMinutes(settings.dayBeforeReminderTime);
          if (Number.isFinite(remMinutes) && now.totalMinutes >= remMinutes && now.totalMinutes <= remMinutes + 30) {
            const tDate = tomorrowDateStr();
            const tDay = tomorrowDay();
            const tDayNorm = normalizeDayOfWeek(tDay);
            const sessions = (device.schedules || [])
              .filter((i: any) => {
                const iDate = normalizeDateStr(i.date);
                const iDay = normalizeDayOfWeek(i.dayOfWeek);
                return iDate ? iDate === tDate : iDay === tDayNorm;
              })
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

    return res.status(200).json({
      ok: true,
      now,
      checked,
      sent,
      errors,
      devicesCount: ids.length,
    });
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
