import notifee, {
  AndroidForegroundServiceType,
  AndroidImportance,
} from "react-native-notify-kit";

const CHANNEL_ID = "ble-controller";
const NOTIFICATION_ID = "ble-controller-service";

let active = false;
let channelReady = false;
let resolveService: (() => void) | null = null;

export function registerService() {
  notifee.registerForegroundService(
    () =>
      new Promise<void>((resolve) => {
        resolveService = resolve;
      }),
  );
}

async function show(body: string) {
  if (!channelReady) {
    await notifee.createChannel({
      id: CHANNEL_ID,
      name: "Controller connection",
      importance: AndroidImportance.LOW,
    });
    channelReady = true;
  }
  await notifee.displayNotification({
    id: NOTIFICATION_ID,
    title: "0xHSC controller",
    body,
    android: {
      channelId: CHANNEL_ID,
      asForegroundService: true,
      ongoing: true,
      onlyAlertOnce: true,
      foregroundServiceTypes: [
        AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE,
      ],
      pressAction: { id: "default", launchActivity: "default" },
      actions: [{ title: "Stop", pressAction: { id: "stop" } }],
    },
  });
}

export async function startForeground(body: string) {
  active = true;
  await show(body);
}

export async function updateNotification(body: string) {
  if (!active) return;
  await show(body).catch(() => {});
}

export async function stopForeground() {
  active = false;
  await notifee.stopForegroundService().catch(() => {});
  resolveService?.();
  resolveService = null;
}
