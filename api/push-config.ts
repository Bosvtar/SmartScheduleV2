import type { VercelRequest, VercelResponse } from "@vercel/node";

const DEFAULT_VAPID_PUBLIC_KEY = "BGqsbtamMJRqSSfWHyXzzH2y9iXUBiyHGLUpw4pl7jcF7OO8Raw0d9aHoUAYtb-98MHERF0xgiDMB_atgyt0kPs";

function isValidBase64Key(key: string | undefined, minLen = 30): boolean {
  if (!key || typeof key !== "string") return false;
  const trimmed = key.trim();
  if (trimmed.includes("your_") || trimmed.includes("replace_") || trimmed.includes("...") || trimmed.length < minLen) {
    return false;
  }
  return true;
}

function getVapidPublicKey() {
  const envPub = process.env.VITE_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
  if (isValidBase64Key(envPub, 60)) return envPub!.trim();
  return DEFAULT_VAPID_PUBLIC_KEY;
}

function isUpstashConfigured(): boolean {
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
}

function isCustomVapidConfigured(): boolean {
  return isValidBase64Key(process.env.VAPID_PUBLIC_KEY, 60);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    return res.status(200).json({
      publicKey: getVapidPublicKey(),
      isUpstashConfigured: isUpstashConfigured(),
      isCustomVapidConfigured: isCustomVapidConfigured(),
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(200).json({
      publicKey: DEFAULT_VAPID_PUBLIC_KEY,
      isUpstashConfigured: false,
      isCustomVapidConfigured: false,
      timestamp: new Date().toISOString(),
    });
  }
}
