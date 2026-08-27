import { NotificationSettings, ScheduleItem } from '../types';

const DEVICE_ID_KEY = 'smartschedule_push_device_id';
const base64UrlToUint8Array = (base64Url: string) => {
  const padding = '='.repeat((4 - base64Url.length % 4) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
};
export const getDeviceId = () => {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) { id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`; localStorage.setItem(DEVICE_ID_KEY,id); }
  return id;
};
export const getPushStatus = async () => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return { supported:false, permission:'denied' as NotificationPermission, subscribed:false };
  const reg=await navigator.serviceWorker.ready;
  const sub=await reg.pushManager.getSubscription();
  return { supported:true, permission:Notification.permission, subscribed:!!sub };
};
export const subscribeToPush = async () => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('Trình duyệt không hỗ trợ Web Push');
  if (Notification.permission !== 'granted') { const p=await Notification.requestPermission(); if (p !== 'granted') throw new Error('Bạn chưa cho phép thông báo'); }
  const key=import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!key) throw new Error('Thiếu VITE_VAPID_PUBLIC_KEY trên Vercel');
  const reg=await navigator.serviceWorker.ready;
  const existing=await reg.pushManager.getSubscription();
  return existing || reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey:base64UrlToUint8Array(key) });
};
export const syncPushState = async (schedules: ScheduleItem[], settings: NotificationSettings) => {
  if (!('serviceWorker' in navigator) || Notification.permission !== 'granted') return { skipped:true };
  const reg=await navigator.serviceWorker.ready;
  const sub=await reg.pushManager.getSubscription();
  if (!sub) return { skipped:true };
  const response=await fetch('/api/push-sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deviceId:getDeviceId(),subscription:sub.toJSON(),schedules,settings,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh'})});
  if (!response.ok) throw new Error((await response.json().catch(()=>({}))).error || 'Đồng bộ Push thất bại');
  return response.json();
};
export const sendServerPushTest = async () => {
  const response=await fetch('/api/push-test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deviceId:getDeviceId()})});
  const data=await response.json().catch(()=>({})); if (!response.ok) throw new Error(data.error || 'Không thể gửi thông báo thử'); return data;
};
