import type { VercelRequest, VercelResponse } from "@vercel/node";
import handler from "./push-test";

export default async function delayedHandler(req: VercelRequest, res: VercelResponse) {
  return handler(req, res);
}
