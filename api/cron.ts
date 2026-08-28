import type { VercelRequest, VercelResponse } from "@vercel/node";
import { redis, deviceKey, deviceSetKey, getVietnamNow, sendPush, type StoredDevice } from "./shared.ts";

function authorized(req: VercelRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.authorization || "";
  const supplied = Array.isArray(req.query.secret) ? req.query.secret[0] : req.query.secret;
  return auth === `Bearer ${secret}` || supplied === secret;
}
function toMinutes(hhmm: string) {
  const [h,m] = String(hhmm || "").split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h*60+m : NaN;
}
function tomorrowDateStr(now = new Date()) {
  const vn = getVietnamNow(now);
  const [dd,mm,yyyy] = vn.dateStr.split('/').map(Number);
  const utc = new Date(Date.UTC(yyyy, mm-1, dd) + 86400000);
  const d=String(utc.getUTCDate()).padStart(2,'0'), m=String(utc.getUTCMonth()+1).padStart(2,'0'), y=utc.getUTCFullYear();
  return `${d}/${m}/${y}`;
}
function tomorrowDay(now = new Date()) { return getVietnamNow(new Date(now.getTime()+86400000)).dayOfWeek; }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });
  if (!authorized(req)) return res.status(401).json({ error: "Unauthorized" });
  const now = getVietnamNow();
  let checked=0, sent=0, errors=0;
  try {
    const ids = await redis.smembers<string>(deviceSetKey);
    for (const deviceId of ids || []) {
      const device = await redis.get<StoredDevice>(deviceKey(deviceId));
      if (!device?.subscription) { await redis.srem(deviceSetKey, deviceId); continue; }
      checked++;
      const settings = device.settings || {};
      if (!settings.enabled) continue;
      const due: { key:string; title:string; body:string }[] = [];
      for (const item of device.schedules || []) {
        const isToday = item.date ? item.date === now.dateStr : item.dayOfWeek === now.dayOfWeek;
        if (!isToday) continue;
        const start = toMinutes(item.startTime);
        for (const offset of (settings.notifyMinutesBefore || [15])) {
          const target = start - Number(offset);
          if (Number.isFinite(target) && now.totalMinutes >= target && now.totalMinutes < target + 2) {
            due.push({
              key: `smartschedule:sent:${deviceId}:${now.dateStr}:${item.id}:before:${offset}`,
              title: `🔔 Nhắc lịch dạy: ${item.subject || "Buổi dạy"}`,
              body: `${item.className ? `Lớp ${item.className}` : "Buổi dạy"}${item.location ? ` • ${item.location}` : ""} • Bắt đầu lúc ${item.startTime} (${offset} phút nữa)${item.lessonName ? ` • ${item.lessonName}` : ""}`
            });
          }
        }
      }
      if (settings.dayBeforeReminder && now.timeStr === settings.dayBeforeReminderTime) {
        const tDate=tomorrowDateStr(), tDay=tomorrowDay();
        const sessions=(device.schedules||[]).filter((i:any)=>i.date ? i.date===tDate : i.dayOfWeek===tDay).sort((a:any,b:any)=>String(a.startTime).localeCompare(String(b.startTime)));
        if (sessions.length) {
          const preview=sessions.slice(0,2).map((s:any)=>`${s.subject} (${s.startTime})`).join(', ');
          due.push({ key:`smartschedule:sent:${deviceId}:${now.dateStr}:day-before`, title:`📅 Lịch dạy ngày mai (${tDay})`, body:`Bạn có ${sessions.length} buổi dạy: ${preview}${sessions.length>2 ? ` và ${sessions.length-2} buổi khác` : ''}.` });
        }
      }
      for (const job of due) {
        const claimed = await redis.set(job.key, "1", { nx:true, ex: 172800 });
        if (!claimed) continue;
        try { await sendPush(device.subscription, { title:job.title, body:job.body, url:"/" }); sent++; }
        catch (error:any) {
          errors++; await redis.del(job.key);
          const code=error?.statusCode || error?.status;
          if (code===404 || code===410) { await redis.del(deviceKey(deviceId)); await redis.srem(deviceSetKey,deviceId); break; }
          console.error("push send error", deviceId, error?.message || error);
        }
      }
    }
    return res.status(200).json({ ok:true, now, checked, sent, errors });
  } catch (error:any) { console.error("cron error",error); return res.status(500).json({ error:error?.message || "Cron failed", checked,sent,errors }); }
}
