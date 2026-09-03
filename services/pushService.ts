import { NotificationSettings, ScheduleItem } from '../types';

const DEVICE_ID_KEY = 'smartschedule_push_device_id';
let cachedVapidPublicKey: string | null = null;

const base64UrlToUint8Array = (base64Url: string) => {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

export const getDeviceId = () => {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
};

export const ensureServiceWorker = async (): Promise<ServiceWorkerRegistration> => {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Trình duyệt không hỗ trợ Service Worker.');
  }
  let reg = await navigator.serviceWorker.getRegistration();
  if (!reg) {
    reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  }
  await navigator.serviceWorker.ready;
  return reg;
};

export interface PushBackendConfig {
  publicKey: string;
  isUpstashConfigured: boolean;
  isCustomVapidConfigured: boolean;
  timestamp?: string;
}

export const fetchPushConfig = async (forceFresh = false): Promise<PushBackendConfig> => {
  try {
    const res = await fetch(`/api/push-config?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (res.ok) {
      const data: PushBackendConfig = await res.json();
      if (data?.publicKey) {
        cachedVapidPublicKey = data.publicKey;
        return data;
      }
    }
  } catch (err) {
    console.warn('Không thể lấy /api/push-config, dùng fallback nội bộ:', err);
  }

  const envKey = (import.meta as any).env?.VITE_VAPID_PUBLIC_KEY;
  const fallbackKey = envKey || 'BGqsbtamMJRqSSfWHyXzzH2y9iXUBiyHGLUpw4pl7jcF7OO8Raw0d9aHoUAYtb-98MHERF0xgiDMB_atgyt0kPs';
  cachedVapidPublicKey = fallbackKey;

  return {
    publicKey: fallbackKey,
    isUpstashConfigured: false,
    isCustomVapidConfigured: Boolean(envKey),
  };
};

export const getPushStatus = async () => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return { supported: false, permission: 'denied' as NotificationPermission, subscribed: false };
  }
  try {
    const reg = await ensureServiceWorker();
    const sub = await reg.pushManager.getSubscription();
    return { supported: true, permission: Notification.permission, subscribed: !!sub };
  } catch {
    return { supported: true, permission: Notification.permission, subscribed: false };
  }
};

const areUint8ArraysEqual = (a: Uint8Array | ArrayBuffer | null | undefined, b: Uint8Array | ArrayBuffer | null | undefined) => {
  if (!a || !b) return false;
  const arrA = a instanceof Uint8Array ? a : new Uint8Array(a);
  const arrB = b instanceof Uint8Array ? b : new Uint8Array(b);
  if (arrA.length !== arrB.length) return false;
  for (let i = 0; i < arrA.length; i++) {
    if (arrA[i] !== arrB[i]) return false;
  }
  return true;
};

export const subscribeToPush = async (forceResubscribe = false) => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Trình duyệt của bạn không hỗ trợ Web Push.');
  }

  if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
    if (Notification.permission === 'denied') {
      throw new Error('Trình duyệt đang chặn thông báo. Vui lòng bấm vào biểu tượng Ổ khóa (hoặc biểu tượng Tune/Cài đặt) ở đầu thanh địa chỉ URL trình duyệt và chuyển "Thông báo (Notifications)" sang "Cho phép (Allow)".');
    }
    const p = await Notification.requestPermission();
    if (p !== 'granted') {
      throw new Error('Bạn chưa cấp quyền thông báo. Hãy bấm "Cho phép" khi trình duyệt hỏi để nhận thông báo lịch dạy.');
    }
  }

  const reg = await ensureServiceWorker();

  // Luôn lấy VAPID Public Key mới nhất từ máy chủ
  const cfg = await fetchPushConfig(true);
  const key = cfg.publicKey;

  if (!key) {
    throw new Error('Không tìm thấy VAPID Public Key để kích hoạt Web Push.');
  }

  const appServerKey = base64UrlToUint8Array(key);
  let existing = await reg.pushManager.getSubscription();

  if (existing) {
    const currentKey = existing.options?.applicationServerKey;
    const isMatching = currentKey ? areUint8ArraysEqual(currentKey, appServerKey) : false;

    if (forceResubscribe || !isMatching) {
      console.log('Hủy đăng ký cũ và tạo Push Subscription mới với VAPID key hiện tại...');
      try {
        await existing.unsubscribe();
      } catch (e) {
        console.warn('Lỗi khi hủy đăng ký cũ:', e);
      }
      existing = null;
    }
  }

  if (!existing) {
    existing = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: appServerKey,
    });
  }

  return existing;
};

export const syncPushState = async (schedules: ScheduleItem[], settings: NotificationSettings) => {
  if (!('serviceWorker' in navigator) || Notification.permission !== 'granted') {
    return { skipped: true, reason: 'Chưa cấp quyền thông báo' };
  }
  const reg = await ensureServiceWorker();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await subscribeToPush();
  }
  if (!sub) return { skipped: true, reason: 'Chưa đăng ký Push' };

  const response = await fetch('/api/push-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId: getDeviceId(),
      subscription: sub.toJSON(),
      schedules,
      settings,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh',
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || 'Đồng bộ Push lên máy chủ thất bại');
  }

  return response.json();
};

export const sendServerPushTest = async (retryOnAuthError = true): Promise<any> => {
  const reg = await ensureServiceWorker();
  let sub = await reg.pushManager.getSubscription();

  if (!sub) {
    sub = await subscribeToPush(false);
  }

  const payload = {
    deviceId: getDeviceId(),
    subscription: sub ? sub.toJSON() : undefined,
  };

  let response = await fetch('/api/push-test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const resText = await response.text();
  let data: any = {};
  try {
    data = JSON.parse(resText);
  } catch {
    data = { error: resText?.slice(0, 150) };
  }
  
  // Nếu khóa VAPID lệch (401/403) hoặc đăng ký hết hạn (410/404), tự động re-subscribe và thử lại 1 lần
  if (!response.ok) {
    const status = response.status;
    if (retryOnAuthError && (status === 401 || status === 403 || status === 404 || status === 410 || status === 400)) {
      console.warn(`Push test trả về mã ${status}, đang tạo lại subscription mới và thử lại...`);
      const newSub = await subscribeToPush(true);
      const retryRes = await fetch('/api/push-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: getDeviceId(),
          subscription: newSub ? newSub.toJSON() : undefined,
        }),
      });
      const retryText = await retryRes.text();
      let retryData: any = {};
      try {
        retryData = JSON.parse(retryText);
      } catch {
        retryData = { error: retryText?.slice(0, 150) };
      }
      if (!retryRes.ok) {
        throw new Error(retryData.error || `Web Push server không gửi được (Mã ${retryRes.status})`);
      }
      return retryData;
    }
    throw new Error(data.error || `Lỗi máy chủ (${response.status}) khi gửi thông báo thử`);
  }
  return data;
};

export const triggerManualCronCheck = async () => {
  const response = await fetch('/api/cron', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Không thể kích hoạt Cron kiểm tra');
  }
  return data;
};

export const testLockScreenPush = async (delaySeconds = 10, retryOnAuthError = true): Promise<any> => {
  const reg = await ensureServiceWorker();
  let sub = await reg.pushManager.getSubscription();

  if (!sub) {
    sub = await subscribeToPush(false);
  }

  const payload = {
    deviceId: getDeviceId(),
    subscription: sub ? sub.toJSON() : undefined,
    delaySeconds,
  };

  // Ưu tiên /api/push-test (đã hỗ trợ delaySeconds), nếu 404 thì thử /api/push-test-delayed
  let response = await fetch('/api/push-test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok && response.status === 404) {
    response = await fetch('/api/push-test-delayed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  const resText = await response.text();
  let data: any = {};
  try {
    data = JSON.parse(resText);
  } catch {
    data = { error: resText?.slice(0, 150) };
  }

  if (!response.ok) {
    const status = response.status;
    if (retryOnAuthError && (status === 401 || status === 403 || status === 410 || status === 400)) {
      console.warn(`Lockscreen test trả về mã ${status}, đang làm mới subscription và thử lại...`);
      const newSub = await subscribeToPush(true);
      const retryRes = await fetch('/api/push-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: getDeviceId(),
          subscription: newSub ? newSub.toJSON() : undefined,
          delaySeconds,
        }),
      });
      const retryText = await retryRes.text();
      let retryData: any = {};
      try {
        retryData = JSON.parse(retryText);
      } catch {
        retryData = { error: retryText?.slice(0, 150) };
      }
      if (!retryRes.ok) {
        throw new Error(retryData.error || `Không thể gửi lệnh kiểm tra (Mã lỗi ${retryRes.status})`);
      }
      return retryData;
    }
    throw new Error(data.error || `Máy chủ phản hồi lỗi (${response.status}) khi gửi lệnh kiểm tra`);
  }
  return data;
};

