# SmartSchedule AI — Vercel + PWA + Web Push + Cron-Job.org

Bản này giữ nguyên giao diện **Kiểm tra lịch** ở đầu trang và bổ sung thông báo nền qua Web Push.

## Kiến trúc

PWA → đăng ký Web Push → `/api/push-sync` → Upstash Redis.
Cron-Job.org gọi `/api/cron` mỗi phút → Vercel Function kiểm tra lịch → Web Push → điện thoại.

## Cài đặt

```bash
npm install
npm run generate:vapid
npm run build
```

### Vercel Environment Variables

- `GEMINI_API_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `VITE_VAPID_PUBLIC_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `CRON_SECRET`

Không dùng `VITE_` cho secret. Chỉ `VITE_VAPID_PUBLIC_KEY` được đưa xuống trình duyệt.

### Cron-Job.org

Tạo job GET mỗi phút gọi:

`https://YOUR-DOMAIN.vercel.app/api/cron?secret=YOUR_CRON_SECRET`

Endpoint cũng hỗ trợ `Authorization: Bearer YOUR_CRON_SECRET`.

### Kiểm tra

- `/api/health` phải trả `ok: true`.
- Trong ứng dụng: Cài đặt thông báo → **Bật Web Push** → **Gửi thử thông báo mẫu ngay**.
- Sau đó tạo lịch vài phút tới, đóng PWA và chờ Cron-Job.org gọi server.

## Lưu ý

Âm thanh tự tạo bằng Web Audio chỉ hoạt động đáng tin cậy khi app đang mở. Thông báo nền do hệ điều hành/trình duyệt quyết định âm thanh và rung.
