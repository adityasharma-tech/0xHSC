import { requireNativeModule } from "expo";

const Native = requireNativeModule("MediaKeys");

const send = (code: number): boolean => {
  try {
    return Native.sendKey(code) as boolean;
  } catch {
    return false;
  }
};

export default {
  playPause: () => send(85),
  play: () => send(126),
  pause: () => send(127),
  next: () => send(87),
  previous: () => send(88),
};
