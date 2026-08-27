import type { VercelRequest, VercelResponse } from "@vercel/node";
import { redis, deviceKey, deviceSetKey } from "./_shared";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });
  try {
    const { deviceId } = req.body || {};
    if (!deviceId) return res.status(400).json({ error: "Thiếu deviceId" });
    await redis.del(deviceKey(deviceId));
    await redis.srem(deviceSetKey, deviceId);
    return res.status(200).json({ ok: true });
  } catch (error: any) { return res.status(500).json({ error: error?.message || "Không thể hủy Push" }); }
}
