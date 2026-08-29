import { Redis } from "@upstash/redis";
import webpush from "web-push";

// In-memory fallback if Upstash credentials are not configured
const memoryStore = new Map<string, any>();
const memorySets = new Map<string, Set<string>>();

let upstashClient: Redis | null = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  try {
    upstashClient = Redis.fromEnv();
  } catch (e) {
    console.warn("Failed to initialize Upstash Redis from env, using memory store:", e);
  }
}

export const redis = {
  get: async <T = any>(key: string): Promise<T | null> => {
    if (upstashClient) {
      try {
        return await upstashClient.get<T>(key);
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
        return await upstashClient.smembers(key);
      } catch (err) {
        console.warn("Upstash Redis smembers error, fallback to memory:", err);
      }
    }
    const set = memorySets.get(key);
    return set ? (Array.from(set) as unknown as T[]) : [];
  },
};

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";

if (publicKey && privateKey) {
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
  } catch (e) {
    console.warn("Failed to set VAPID details:", e);
  }
}

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
}

export async function sendPush(subscription: PushSubscriptionJSON, payload: unknown) {
  if (!publicKey || !privateKey) throw new Error("Thiếu VAPID_PUBLIC_KEY hoặc VAPID_PRIVATE_KEY");
  return webpush.sendNotification(subscription as any, JSON.stringify(payload), { TTL: 120 });
}
