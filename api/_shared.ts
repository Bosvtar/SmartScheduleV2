import { Redis } from "@upstash/redis";
import { createRequire } from "module";

// Safe require for CommonJS packages in Node ESM
let webpushLib: any = null;
function getWebPush() {
  if (webpushLib) return webpushLib;
  try {
    const require = createRequire(import.meta.url);
    webpushLib = require("web-push");
  } catch {
    try {
      // Fallback
      webpushLib = (globalThis as any).webpush;
    } catch {
      webpushLib = null;
    }
  }
  return webpushLib;
}

// In-memory fallback if Upstash credentials are not configured
const memoryStore = new Map<string, any>();
const memorySets = new Map<string, Set<string>>();

let upstashClient: Redis | null = null;
const rawUrl = process.env.UPSTASH_REDIS_REST_URL;
const rawToken = process.env.UPSTASH_REDIS_REST_TOKEN;

if (rawUrl && rawToken && typeof rawUrl === "string" && typeof rawToken === "string") {
  const cleanUrl = rawUrl.trim();
  const cleanToken = rawToken.trim();
  if (cleanUrl.startsWith("http") && !cleanUrl.includes("your-") && !cleanToken.includes("your-")) {
    try {
      upstashClient = new Redis({
        url: cleanUrl,
        token: cleanToken,
      });
    } catch (e) {
      console.warn("Failed to initialize Upstash Redis from env, using memory store:", e);
      upstashClient = null;
    }
  }
}

export const redis = {
  get: async <T = any>(key: string): Promise<T | null> => {
    if (upstashClient) {
      try {
        const res = await upstashClient.get<T>(key);
        return res !== undefined ? res : null;
      } catch (err) {
        console.warn("Upstash Redis get error, fallback to memory:", err);
      }
    }
    const val = memoryStore.get(key);
    return (val !== undefined ? val : null) as T | null;
  },
  set: async (key: string, value: any, options?: { nx?: boolean; ex?: number }): Promise<any> => {
    if (upstashClient) {
      try {
        return await upstashClient.set(key, value, options);
      } catch (err) {
        console.warn("Upstash Redis set error, fallback to memory:", err);
      }
    }
    if (options?.nx && memoryStore.has(key)) {
      return null;
    }
    memoryStore.set(key, value);
    return "OK";
  },
  del: async (key: string): Promise<number> => {
    if (upstashClient) {
      try {
        return await upstashClient.del(key);
      } catch (err) {
        console.warn("Upstash Redis del error, fallback to memory:", err);
      }
    }
    const existed = memoryStore.delete(key);
    return existed ? 1 : 0;
  },
  sadd: async (key: string, member: string): Promise<number> => {
    if (upstashClient) {
      try {
        return await upstashClient.sadd(key, member);
      } catch (err) {
        console.warn("Upstash Redis sadd error, fallback to memory:", err);
      }
    }
    if (!memorySets.has(key)) {
      memorySets.set(key, new Set());
    }
    const set = memorySets.get(key)!;
    const sizeBefore = set.size;
    set.add(member);
    return set.size - sizeBefore;
  },
  srem: async (key: string, member: string): Promise<number> => {
    if (upstashClient) {
      try {
        return await upstashClient.srem(key, member);
      } catch (err) {
        console.warn("Upstash Redis srem error, fallback to memory:", err);
      }
    }
    const set = memorySets.get(key);
    if (!set) return 0;
    const deleted = set.delete(member);
    return deleted ? 1 : 0;
  },
  smembers: async <T = string>(key: string): Promise<T[]> => {
    if (upstashClient) {
      try {
        const res = await upstashClient.smembers(key);
        return Array.isArray(res) ? (res as unknown as T[]) : [];
      } catch (err) {
        console.warn("Upstash Redis smembers error, fallback to memory:", err);
      }
    }
    const set = memorySets.get(key);
    return set ? (Array.from(set) as unknown as T[]) : [];
  },
};

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

export const getVapidPublicKey = () => {
  const envPub = process.env.VITE_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
  if (isValidBase64Key(envPub, 60)) {
    return envPub!.trim();
  }
  return DEFAULT_VAPID_PUBLIC_KEY;
};

export const getVapidPrivateKey = () => {
  const envPriv = process.env.VAPID_PRIVATE_KEY;
  if (isValidBase64Key(envPriv, 30)) {
    return envPriv!.trim();
  }
  return DEFAULT_VAPID_PRIVATE_KEY;
};

export const getVapidSubject = () => {
  const envSub = process.env.VAPID_SUBJECT;
  if (envSub && envSub.includes("@") && !envSub.includes("your_")) {
    return envSub.trim();
  }
  return DEFAULT_VAPID_SUBJECT;
};

export const isUpstashConfigured = () => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return Boolean(
    url &&
    token &&
    typeof url === "string" &&
    typeof token === "string" &&
    url.startsWith("http") &&
    !url.includes("your-") &&
    !token.includes("your-")
  );
};

export const isCustomVapidConfigured = () => {
  return Boolean(
    isValidBase64Key(process.env.VAPID_PUBLIC_KEY, 60) &&
    isValidBase64Key(process.env.VAPID_PRIVATE_KEY, 30)
  );
};

export type StoredDevice = {
  deviceId: string;
  subscription: PushSubscriptionJSON;
  schedules: any[];
  settings: any;
  timezone: string;
  updatedAt: string;
};

export type PushSubscriptionJSON = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  expirationTime?: number | null;
};

export const deviceKey = (id: string) => `smartschedule:device:${id}`;
export const deviceSetKey = "smartschedule:devices";

export function getVietnamNow(date = new Date()) {
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
    const dayMap: Record<string,string> = {
      monday: "Thứ 2", tuesday: "Thứ 3", wednesday: "Thứ 4", thursday: "Thứ 5",
      friday: "Thứ 6", saturday: "Thứ 7", sunday: "Chủ Nhật"
    };
    return {
      dateStr: `${day}/${month}/${year}`,
      timeStr: `${hour}:${minute}`,
      totalMinutes: Number(hour) * 60 + Number(minute),
      dayOfWeek: dayMap[weekdayEn] || "",
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

export async function sendPush(subscription: PushSubscriptionJSON, payload: unknown) {
  const wp = getWebPush();
  if (!wp) {
    throw new Error("Thư viện web-push chưa sẵn sàng trên môi trường này");
  }
  const activePub = getVapidPublicKey();
  const activePriv = getVapidPrivateKey();
  const activeSub = getVapidSubject();
  if (!activePub || !activePriv) throw new Error("Thiếu VAPID_PUBLIC_KEY hoặc VAPID_PRIVATE_KEY");
  
  try {
    wp.setVapidDetails(activeSub, activePub, activePriv);
  } catch (err: any) {
    console.warn("setVapidDetails warning:", err?.message || err);
  }
  
  return wp.sendNotification(subscription as any, JSON.stringify(payload), { TTL: 120 });
}

