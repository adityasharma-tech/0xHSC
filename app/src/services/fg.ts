import notifee, { Event, EventType } from "react-native-notify-kit";
import { stopBle } from "./ble";
import { registerService } from "./notification";

async function onEvent({ type, detail }: Event) {
  if (type === EventType.ACTION_PRESS && detail.pressAction?.id === "stop") {
    await stopBle();
  }
}

registerService();
notifee.onForegroundEvent(onEvent);
notifee.onBackgroundEvent(onEvent);
