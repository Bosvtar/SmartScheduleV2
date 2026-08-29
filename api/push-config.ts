import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getVapidPublicKey, isUpstashConfigured, isCustomVapidConfigured } from "./_shared";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });
  
  return res.status(200).json({
    publicKey: getVapidPublicKey(),
    isUpstashConfigured: isUpstashConfigured(),
    isCustomVapidConfigured: isCustomVapidConfigured(),
    timestamp: new Date().toISOString(),
  });
}
