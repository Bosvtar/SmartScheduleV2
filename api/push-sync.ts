import type { VercelRequest, VercelResponse } from "@vercel/node";
import { redis, deviceKey, deviceSetKey, type StoredDevice } from "./_shared";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });
  try {
    const { deviceId, subscription, schedules, settings, timezone } = req.body || {};
    if (!deviceId || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ error: "Thiếu deviceId hoặc Push subscription hợp lệ" });
    }
    const device: StoredDevice = {
      deviceId, subscription, schedules: Array.isArray(schedules) ? schedules : [],
      settings: settings || {}, timezone: timezone || "Asia/Ho_Chi_Minh", updatedAt: new Date().toISOString()
    };
    await redis.set(deviceKey(deviceId), device);
    await redis.sadd(deviceSetKey, deviceId);
    return res.status(200).json({ ok: true, deviceId, scheduleCount: device.schedules.length });
  } catch (error: any) {
    console.error("push-sync error", error);
    return res.status(500).json({ error: error?.message || "Không thể đồng bộ Push" });
  }
}
