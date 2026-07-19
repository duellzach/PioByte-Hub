import { api } from './api';

// Web Push works on Chrome/Edge (desktop + Android + ChromeOS) and, since
// iOS/iPadOS 16.4, on Safari — but only when the app is installed to the home
// screen. This util fails gracefully everywhere else.

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** 'unsupported' | 'default' (not yet asked) | 'granted' | 'denied' | 'subscribed' */
export type PushStatus = 'unsupported' | 'default' | 'denied' | 'granted' | 'subscribed';

export async function getPushStatus(): Promise<PushStatus> {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission === 'default') return 'default';
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub ? 'subscribed' : 'granted';
  } catch {
    return 'granted';
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Ask permission, subscribe this device, and register it with the server.
 *  Returns true on success. Throws with a user-friendly message on failure. */
export async function enablePush(): Promise<boolean> {
  if (!pushSupported()) throw new Error('This device or browser does not support push notifications.');

  const { publicKey, enabled } = await api.push.vapidPublicKey();
  if (!enabled || !publicKey) throw new Error('Push notifications are not configured on the server yet.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission was not granted.');

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }
  await api.push.subscribe(sub.toJSON());
  return true;
}

export async function disablePush(): Promise<void> {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await api.push.unsubscribe(sub.endpoint).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
}
