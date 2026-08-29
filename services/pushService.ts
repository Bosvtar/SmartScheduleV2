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

export const fetchPushConfig = async (): Promise<PushBackendConfig> => {
  try {
    const res = await fetch('/api/push-config');
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
  const fallbackKey = envKey || 'BGZJFjvBlHSH2SfRq-qiyogY60cs8SCkB7Oexh9tvobOJjTXWf0tdlv23BD6S0dKj65ir-WJsB8zrbdREg8Rk10';
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

  if (Notification.permission !== 'granted') {
    const p = await Notification.requestPermission();
    if (p !== 'granted') throw new Error('Bạn chưa cho phép quyền thông báo trên trình duyệt.');
  }

  const reg = await ensureServiceWorker();

  let key = cachedVapidPublicKey || (import.meta as any).env?.VITE_VAPID_PUBLIC_KEY;
  if (!key) {
    const cfg = await fetchPushConfig();
    key = cfg.publicKey;
  }

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
    sub = await subscribeToPush(true);
  }

  const response = await fetch('/api/push-test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId: getDeviceId(),
      subscription: sub ? sub.toJSON() : undefined,
    }),
  });

  const data = await response.json().catch(() => ({}));
  
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
      const retryData = await retryRes.json().catch(() => ({}));
      if (!retryRes.ok) {
        throw new Error(retryData.error || 'Web Push server không gửi được');
      }
      return retryData;
    }
    throw new Error(data.error || 'Không thể gửi thông báo thử từ máy chủ');
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

