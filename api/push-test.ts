import type { VercelRequest, VercelResponse } from "@vercel/node";
import { redis, deviceKey, sendPush, type StoredDevice } from "./_shared";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });
  try {
    const { deviceId } = req.body || {};
    if (!deviceId) return res.status(400).json({ error: "Thiếu deviceId" });
    const device = await redis.get<StoredDevice>(deviceKey(deviceId));
    if (!device) return res.status(404).json({ error: "Thiết bị chưa được đồng bộ. Hãy bấm Bật thông báo trước." });
    await sendPush(device.subscription, {
      title: "🔔 SmartSchedule - Thông báo thử",
      body: "Nếu bạn nhìn thấy thông báo này thì Web Push đang hoạt động.",
      url: "/"
    });
    return res.status(200).json({ ok: true });
  } catch (error: any) {
    const status = error?.statusCode || error?.status;
    console.error("push-test error", error);
    return res.status(status === 410 || status === 404 ? 410 : 500).json({ error: error?.body || error?.message || "Không thể gửi Push thử" });
  }
}
