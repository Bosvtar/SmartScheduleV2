import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getVapidPublicKey, isUpstashConfigured, isCustomVapidConfigured } from "./_shared";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });
  
  return res.status(200).json({
    publicKey: getVapidPublicKey(),
    isUpstashConfigured: isUpstashConfigured(),
    isCustomVapidConfigured: isCustomVapidConfigured(),
    timestamp: new Date().toISOString(),
  });
}

