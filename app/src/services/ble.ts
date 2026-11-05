import { PermissionsAndroid, Platform } from "react-native";
import {
  BleManager,
  Device,
  ScanMode,
  State,
  Subscription,
} from "react-native-ble-plx";
import { VolumeManager } from "react-native-volume-manager";
import MediaKeys from "../../modules/media-keys";
import {
  startForeground,
  stopForeground,
  updateNotification,
} from "./notification";
import { useBle } from "./store";

const ESP_NAME = "0xHSC";
const SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const CHARACTERISTIC_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";
const RETRY_MS = 4000;
const CONNECT_TIMEOUT_MS = 10000;

const manager = new BleManager();
const { setVolume, setDevice, setDevices, setConnecting, setScanning } =
  useBle.getState();

let running = false;
let ready = false;
let autoReconnect = true;
let pickerActive = false;
let connecting = false;
let current: Device | null = null;
let targetId: string | null = null;
let buffer = "";
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let stateSub: Subscription | null = null;
let monitorSub: Subscription | null = null;
let disconnectSub: Subscription | null = null;
let volumeSub: { remove: () => void } | null = null;

const label = (d: Device) => d.name ?? d.localName ?? d.id;

export async function ensurePermissions() {
  if (Platform.OS !== "android") return false;
  const P = PermissionsAndroid.PERMISSIONS;
  const api = Number(Platform.Version);
  const wanted =
    api >= 31
      ? [P.BLUETOOTH_SCAN, P.BLUETOOTH_CONNECT]
      : [P.ACCESS_FINE_LOCATION];
  const result = await PermissionsAndroid.requestMultiple(wanted);
  if (api >= 33) {
    await PermissionsAndroid.request(P.POST_NOTIFICATIONS).catch(() => {});
  }
  return wanted.every((p) => result[p] === PermissionsAndroid.RESULTS.GRANTED);
}

function applyVolume(pct: number) {
  const v = Math.min(100, Math.max(0, Math.round(pct)));
  setVolume(v);
  VolumeManager.setVolume(v / 100, { type: "music", showUI: false }).catch(
    () => {},
  );
}

function handleLine(raw: string) {
  const line = raw.trim();
  if (!line) return;
  if (line === "P") MediaKeys.playPause();
  else if (line === "S") MediaKeys.next();
  else if (line.startsWith("V:")) {
    const n = Number(line.slice(2));
    if (Number.isFinite(n)) applyVolume(n);
  }
}

function onChunk(base64: string) {
  let text = "";
  try {
    text = atob(base64);
  } catch {
    return;
  }
  buffer += text;
  let index = buffer.indexOf("\n");
  while (index >= 0) {
    handleLine(buffer.slice(0, index));
    buffer = buffer.slice(index + 1);
    index = buffer.indexOf("\n");
  }
  if (buffer.length > 256) buffer = "";
}

function watchVolume() {
  VolumeManager.getVolume()
    .then((r: any) => {
      const v = typeof r === "number" ? r : r?.volume;
      if (typeof v === "number") setVolume(Math.round(v * 100));
    })
    .catch(() => {});
  volumeSub = VolumeManager.addVolumeListener((r: any) => {
    if (r?.type && r.type !== "music") return;
    setVolume(Math.round((r?.volume ?? 0) * 100));
  });
}

function clearRetry() {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

function scheduleAttempt(delay = RETRY_MS) {
  clearRetry();
  if (!running) return;
  retryTimer = setTimeout(attempt, delay);
}

function stopScan() {
  manager.stopDeviceScan();
  setScanning(false);
}

function addDevice(device: Device) {
  if (!device.name && !device.localName) return;
  const list = useBle.getState().devices;
  if (list.some((d) => d.id === device.id)) return;
  setDevices([...list, device]);
}

function startScan(all: boolean) {
  manager.stopDeviceScan();
  setScanning(true);
  manager.startDeviceScan(
    all ? null : [SERVICE_UUID],
    { scanMode: all ? ScanMode.LowLatency : ScanMode.Balanced },
    (error, device) => {
      if (error) {
        stopScan();
        if (!all) scheduleAttempt();
        return;
      }
      if (!device) return;
      if (all) {
        addDevice(device);
        return;
      }
      if (device.name === ESP_NAME || device.localName === ESP_NAME) {
        stopScan();
        targetId = device.id;
        connect(device.id);
      }
    },
  );
}

function dropConnection() {
  monitorSub?.remove();
  monitorSub = null;
  disconnectSub?.remove();
  disconnectSub = null;
  current = null;
  buffer = "";
  setDevice(null);
}

async function connect(id: string) {
  if (connecting) return;
  connecting = true;
  setConnecting(true);
  updateNotification("Connecting…");
  try {
    const device = await manager.connectToDevice(id, {
      timeout: CONNECT_TIMEOUT_MS,
    });
    await device.discoverAllServicesAndCharacteristics();
    if (!running) {
      await device.cancelConnection().catch(() => {});
      return;
    }
    current = device;
    targetId = id;
    buffer = "";
    disconnectSub = manager.onDeviceDisconnected(id, () => {
      dropConnection();
      updateNotification("Disconnected, reconnecting…");
      scheduleAttempt();
    });
    monitorSub = device.monitorCharacteristicForService(
      SERVICE_UUID,
      CHARACTERISTIC_UUID,
      (error, characteristic) => {
        if (error || !characteristic?.value) return;
        onChunk(characteristic.value);
      },
    );
    setDevice(device);
    updateNotification(`Connected to ${label(device)}`);
  } catch {
    manager.cancelDeviceConnection(id).catch(() => {});
    updateNotification("Connection failed, retrying…");
    scheduleAttempt();
  } finally {
    connecting = false;
    setConnecting(false);
  }
}

async function attempt() {
  if (!running || !ready || !autoReconnect || pickerActive) return;
  if (connecting || current) return;
  if (targetId) await connect(targetId);
  else {
    updateNotification("Searching…");
    startScan(false);
  }
}

export async function startBle() {
  if (running) return true;
  if (!(await ensurePermissions())) return false;
  running = true;
  autoReconnect = true;
  await startForeground("Starting…");
  watchVolume();
  stateSub = manager.onStateChange((state) => {
    if (state === State.PoweredOn) {
      ready = true;
      scheduleAttempt(0);
    } else {
      ready = false;
      clearRetry();
      stopScan();
      dropConnection();
      updateNotification("Bluetooth is off");
    }
  }, true);
  return true;
}

export async function stopBle() {
  running = false;
  ready = false;
  pickerActive = false;
  clearRetry();
  stopScan();
  stateSub?.remove();
  stateSub = null;
  volumeSub?.remove();
  volumeSub = null;
  const id = current?.id ?? targetId;
  dropConnection();
  if (id) await manager.cancelDeviceConnection(id).catch(() => {});
  setConnecting(false);
  await stopForeground();
}

export async function selectDevice(id: string) {
  autoReconnect = true;
  pickerActive = false;
  stopScan();
  clearRetry();
  if (current?.id === id) return;
  if (current) {
    const previous = current.id;
    dropConnection();
    await manager.cancelDeviceConnection(previous).catch(() => {});
  }
  targetId = id;
  await connect(id);
}

export async function disconnectDevice() {
  autoReconnect = false;
  clearRetry();
  const id = current?.id;
  dropConnection();
  if (id) await manager.cancelDeviceConnection(id).catch(() => {});
  updateNotification("Disconnected");
}

export async function startPickerScan() {
  if (!(await startBle())) return;
  pickerActive = true;
  clearRetry();
  setDevices([]);
  startScan(true);
}

export function stopPickerScan() {
  if (!pickerActive) return;
  pickerActive = false;
  stopScan();
  scheduleAttempt(0);
}
