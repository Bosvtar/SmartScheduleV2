import type { VercelRequest, VercelResponse } from "@vercel/node";
import { redis, deviceKey, sendPush, type StoredDevice } from "./_shared";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });
  try {
    const { deviceId, subscription } = req.body || {};
    let targetSub = subscription;

    if (!targetSub && deviceId) {
      const device = await redis.get<StoredDevice>(deviceKey(deviceId));
      if (device?.subscription) {
        targetSub = device.subscription;
      }
    }

    if (!targetSub?.endpoint || !targetSub?.keys?.p256dh || !targetSub?.keys?.auth) {
      return res.status(404).json({ error: "Chưa tìm thấy đăng ký Push của thiết bị. Hãy bấm Bật Web Push trước." });
    }

    await sendPush(targetSub, {
      title: "🔔 SmartSchedule - Thông báo thử",
      body: "Nếu bạn nhìn thấy thông báo này thì Web Push trên Vercel đang hoạt động rất tốt!",
      url: "/"
    });
    return res.status(200).json({ ok: true });
  } catch (error: any) {
    const status = error?.statusCode || error?.status;
    console.error("push-test error", error);
    return res.status(status === 410 || status === 404 ? 410 : 500).json({ error: error?.body || error?.message || "Không thể gửi Push thử" });
  }
}
