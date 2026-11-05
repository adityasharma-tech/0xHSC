import { Device } from "react-native-ble-plx";
import { create } from "zustand";

interface BleState {
  devices: Device[];
  device: Device | null;
  connecting: boolean;
  scanning: boolean;
  visible: boolean;
  volume: number;
  setVisible: (visible: boolean) => void;
  setVolume: (volume: number) => void;
  setDevice: (device: Device | null) => void;
  setDevices: (devices: Device[]) => void;
  setConnecting: (connecting: boolean) => void;
  setScanning: (scanning: boolean) => void;
}

const useBle = create<BleState>()((set) => ({
  devices: [],
  device: null,
  connecting: false,
  scanning: false,
  visible: false,
  volume: 0,
  setVisible: (visible) => set({ visible }),
  setVolume: (volume) => set({ volume }),
  setDevice: (device) => set({ device }),
  setDevices: (devices) => set({ devices }),
  setConnecting: (connecting) => set({ connecting }),
  setScanning: (scanning) => set({ scanning }),
}));

export { useBle };
