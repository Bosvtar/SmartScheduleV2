import { Redis } from "@upstash/redis";
import { createRequire } from "module";
import fs from "fs";
import path from "path";

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

// In-memory fallback if Upstash credentials are not configured, with file-based persistence
const memoryStore = new Map<string, any>();
const memorySets = new Map<string, Set<string>>();

const LOCAL_STORE_FILE = path.join(process.cwd(), ".devices_store.json");

function loadLocalStore() {
  try {
    if (fs.existsSync(LOCAL_STORE_FILE)) {
      const content = fs.readFileSync(LOCAL_STORE_FILE, "utf-8");
      const parsed = JSON.parse(content);
      if (parsed?.store && typeof parsed.store === "object") {
        for (const [k, v] of Object.entries(parsed.store)) {
          memoryStore.set(k, v);
        }
      }
      if (parsed?.sets && typeof parsed.sets === "object") {
        for (const [k, v] of Object.entries(parsed.sets)) {
          if (Array.isArray(v)) {
            memorySets.set(k, new Set(v));
          }
        }
      }
    }
  } catch (e) {
    console.warn("Could not load local devices store:", e);
  }
}

let saveTimeout: any = null;
function persistLocalStore() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      const storeObj: Record<string, any> = {};
      for (const [k, v] of memoryStore.entries()) {
        storeObj[k] = v;
      }
      const setsObj: Record<string, string[]> = {};
      for (const [k, v] of memorySets.entries()) {
        setsObj[k] = Array.from(v);
      }
      fs.writeFileSync(LOCAL_STORE_FILE, JSON.stringify({ store: storeObj, sets: setsObj }), "utf-8");
    } catch (e) {
      console.warn("Could not persist local devices store:", e);
    }
  }, 1000);
}

loadLocalStore();

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
    persistLocalStore();
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
    if (existed) persistLocalStore();
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
    persistLocalStore();
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
    if (deleted) persistLocalStore();
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

export function normalizeDayOfWeek(day: string): string {
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

export function normalizeDateStr(dateStr?: string): string {
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

export function toMinutes(raw: string): number {
  if (!raw) return NaN;
  const clean = String(raw).trim().replace(/h/i, ":");
  const parts = clean.split(":").map(p => parseInt(p.trim(), 10));
  if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
    return parts[0] * 60 + parts[1];
  }
  return NaN;
}

export function tomorrowDateStr(now = new Date()) {
  const vn = getVietnamNow(now);
  const [dd, mm, yyyy] = vn.dateStr.split("/").map(Number);
  const utc = new Date(Date.UTC(yyyy, mm - 1, dd) + 86400000);
  const d = String(utc.getUTCDate()).padStart(2, "0");
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const y = utc.getUTCFullYear();
  return `${d}/${m}/${y}`;
}

export function tomorrowDay(now = new Date()) {
  return getVietnamNow(new Date(now.getTime() + 86400000)).dayOfWeek;
}

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
  
  // Note: Do not set static "topic" here because in RFC 8030 it collapses messages
  // and FCM throttles topic-based notifications when mobile devices are sleeping.
  return wp.sendNotification(subscription as any, JSON.stringify(payload), {
    TTL: 86400,
    urgency: "high"
  });
}

