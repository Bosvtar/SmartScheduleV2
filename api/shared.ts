import { Redis } from "@upstash/redis";
import webpush from "web-push";

export const redis = Redis.fromEnv();

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";

if (publicKey && privateKey) {
  webpush.setVapidDetails(subject, publicKey, privateKey);
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
