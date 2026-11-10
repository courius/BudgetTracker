/**
 * Android only: reads card-payment notifications captured by the native listener
 * (modules/bank-notifications) and turns them into "detected" expenses awaiting confirmation.
 * iOS does not let apps read other apps' notifications — see README for the Shortcuts route.
 */
import { requireOptionalNativeModule } from 'expo';
import { PermissionsAndroid, Platform } from 'react-native';

import { parseNotification } from './parseNotification';
import { useStore } from './store';

type Native = { isEnabled(): boolean; openSettings(): void; drain(): string };
type Captured = { packageName: string; title: string; text: string; postedAt: number };

const native = Platform.OS === 'android' ? requireOptionalNativeModule<Native>('BankNotifications') : null;

export const detectionSupported = native !== null;

export function isDetectionEnabled(): boolean {
  return native?.isEnabled() ?? false;
}

export async function enableDetection(): Promise<void> {
  if (!native) return;
  // Lets us show the "New expense detected" prompt on Android 13+.
  await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS).catch(() => {});
  native.openSettings();
}

/** Moves anything the listener captured into the confirmation queue. */
export function collectDetected(): void {
  if (!native) return;
  let captured: Captured[] = [];
  try {
    captured = JSON.parse(native.drain());
  } catch {
    return;
  }
  for (const n of captured) {
    const spend = parseNotification(n.title, n.text);
    if (spend) useStore.getState().addDetected({ ...spend, source: 'notification', at: new Date(n.postedAt).toISOString() });
  }
}
