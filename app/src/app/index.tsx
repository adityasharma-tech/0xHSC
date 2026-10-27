import {
  Alert,
  FlatList,
  Modal,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCallback, useEffect, useRef, useState } from "react";
import RNBluetoothClassic, {
  BluetoothDevice,
} from "react-native-bluetooth-classic";
import { VolumeManager } from "react-native-volume-manager";
import { AnimatedIcon } from "@/components/animated-icon";
import { ThemedView } from "@/components/themed-view";
import GaugeComp from "@/components/gauge";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import {
  Box,
  HorizontalFloatingToolbar,
  Host,
  Icon,
  IconButton,
} from "@expo/ui/jetpack-compose";
import {
  align,
  fillMaxSize,
  offset,
  size,
} from "@expo/ui/jetpack-compose/modifiers";
import MediaKeys from "../../modules/media-keys"; // adjust if your folders differ

const ESP_NAME = "0xHSC";
const RETRY_MS = 5000;
const CONNECT_OPTIONS: any = { DELIMITER: "\n" };

async function ensureBluetoothPermissions() {
  if (Platform.OS !== "android") return false;
  const P = PermissionsAndroid.PERMISSIONS;
  const wanted =
    Number(Platform.Version) >= 31
      ? [P.BLUETOOTH_CONNECT]
      : [P.ACCESS_FINE_LOCATION];
  const result = await PermissionsAndroid.requestMultiple(wanted);
  return wanted.every((p) => result[p] === PermissionsAndroid.RESULTS.GRANTED);
}

type PickerProps = {
  visible: boolean;
  devices: BluetoothDevice[];
  connectedAddress: string | null;
  onSelect: (device: BluetoothDevice) => void;
  onDisconnect: () => void;
  onClose: () => void;
};

function DevicePickerModal({
  visible,
  devices,
  connectedAddress,
  onSelect,
  onDisconnect,
  onClose,
}: PickerProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* tap outside to close */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.dialog}>
          <View style={styles.header}>
            <Text style={styles.title}>Paired Devices</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.closeButton}>✕</Text>
            </Pressable>
          </View>

          {connectedAddress && (
            <Pressable style={styles.disconnectRow} onPress={onDisconnect}>
              <Text style={styles.disconnectText}>Disconnect</Text>
            </Pressable>
          )}

          <FlatList
            data={devices}
            keyExtractor={(item) => item.address}
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text style={styles.empty}>
                No paired devices. Pair {ESP_NAME} in Android's Bluetooth
                settings first.
              </Text>
            }
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item }) => (
              <Pressable style={styles.item} onPress={() => onSelect(item)}>
                <View style={styles.itemContent}>
                  <Text style={styles.itemTitle}>
                    {item.name ?? item.address}
                    {item.address === connectedAddress ? "  • connected" : ""}
                  </Text>
                  <Text style={styles.subtitle}>{item.address}</Text>
                </View>
              </Pressable>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

export default function HomeScreen() {
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [device, setDevice] = useState<BluetoothDevice | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [visible, setVisible] = useState(false);
  const [volume, setVolume] = useState(0);

  const connected = device !== null;

  // refs so timers/callbacks never see stale values
  const deviceRef = useRef<BluetoothDevice | null>(null);
  const connectingRef = useRef(false);
  const targetAddress = useRef<string | null>(null); // device we keep reconnecting to
  const autoReconnect = useRef(true);
  const permissionsOk = useRef(false);

  const updateDevice = useCallback((d: BluetoothDevice | null) => {
    deviceRef.current = d;
    setDevice(d);
  }, []);

  // ---------- phone control ----------
  const applyVolume = useCallback((pct: number) => {
    const v = Math.min(100, Math.max(0, Math.round(pct)));
    setVolume(v);
    VolumeManager.setVolume(v / 100, { type: "music", showUI: false }).catch(
      (e: unknown) => console.warn("setVolume failed", e),
    );
  }, []);

  // one line from the ESP32: "P", "S" or "V:73"
  const handleLine = useCallback(
    (raw: string) => {
      const line = raw.trim();
      if (!line) return;
      if (line === "P") MediaKeys.play();
      else if (line === "S") MediaKeys.pause();
      else if (line.startsWith("V:")) {
        const n = Number(line.slice(2));
        if (Number.isFinite(n)) applyVolume(n);
      }
    },
    [applyVolume],
  );

  // ---------- bluetooth ----------
  const loadDevices = useCallback(async () => {
    try {
      if (!(await RNBluetoothClassic.isBluetoothEnabled())) {
        await RNBluetoothClassic.requestBluetoothEnabled();
      }
      const paired = await RNBluetoothClassic.getBondedDevices();
      setDevices(paired);
      return paired;
    } catch (error: any) {
      Alert.alert(
        "Bluetooth Error",
        error?.message ?? "Could not load paired devices",
      );
      return [];
    }
  }, []);

  const connectDevice = useCallback(
    async (target: BluetoothDevice, silent = false) => {
      if (connectingRef.current) return;
      connectingRef.current = true;
      setConnecting(true);

      try {
        const current = deviceRef.current;
        if (current && current.address !== target.address) {
          await current.disconnect().catch(() => {});
          updateDevice(null);
        }

        if (!(await target.isConnected())) {
          await target.connect(CONNECT_OPTIONS);
        }
        if (!(await target.isConnected())) {
          throw new Error("Could not open a connection");
        }

        targetAddress.current = target.address;
        autoReconnect.current = true;
        updateDevice(target);
      } catch (error: any) {
        if (!silent) {
          Alert.alert(
            "Connection Failed",
            error?.message ?? "Unable to connect to the device",
          );
        }
      } finally {
        connectingRef.current = false;
        setConnecting(false);
      }
    },
    [updateDevice],
  );

  const disconnectDevice = useCallback(async () => {
    autoReconnect.current = false; // user chose to disconnect: stop retrying
    try {
      await deviceRef.current?.disconnect();
    } catch (error) {
      console.warn("Disconnect error:", error);
    } finally {
      updateDevice(null);
      setVisible(false);
    }
  }, [updateDevice]);

  const openPicker = () => {
    loadDevices();
    setVisible(true);
  };

  // first launch: permissions, then connect to the ESP32 if it is already paired
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await ensureBluetoothPermissions();
      permissionsOk.current = ok;
      if (!ok) {
        Alert.alert(
          "Permission needed",
          "Bluetooth permission is required to talk to the controller.",
        );
        return;
      }
      const paired = await loadDevices();
      if (cancelled) return;
      const esp = paired.find((d) => d.name === ESP_NAME);
      if (esp) {
        targetAddress.current = esp.address;
        connectDevice(esp, true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadDevices, connectDevice]);

  // listen for lines while connected
  useEffect(() => {
    if (!device) return;
    const subscription = device.onDataReceived((event: any) => {
      handleLine(String(event.data ?? ""));
    });
    return () => subscription.remove();
  }, [device, handleLine]);

  // the OS tells us when the link drops
  useEffect(() => {
    const subscription = RNBluetoothClassic.onDeviceDisconnected((event: any) => {
      if (event?.device?.address === deviceRef.current?.address) {
        updateDevice(null);
      }
    });
    return () => subscription.remove();
  }, [updateDevice]);

  // headphone-style reconnect while the app is open
  useEffect(() => {
    const id = setInterval(async () => {
      if (
        deviceRef.current ||
        connectingRef.current ||
        !autoReconnect.current ||
        !targetAddress.current ||
        !permissionsOk.current
      ) {
        return;
      }
      try {
        const paired = await RNBluetoothClassic.getBondedDevices();
        const target = paired.find((d) => d.address === targetAddress.current);
        if (target) connectDevice(target, true);
      } catch {
        // ignore, try again next tick
      }
    }, RETRY_MS);
    return () => clearInterval(id);
  }, [connectDevice]);

  // keep the gauge in sync with the phone's own volume buttons
  useEffect(() => {
    VolumeManager.getVolume()
      .then((r: any) => {
        const v = typeof r === "number" ? r : r?.volume;
        if (typeof v === "number") setVolume(Math.round(v * 100));
      })
      .catch(() => {});

    const subscription = VolumeManager.addVolumeListener((r: any) => {
      if (r?.type && r.type !== "music") return;
      setVolume(Math.round((r?.volume ?? 0) * 100));
    });
    return () => subscription.remove();
  }, []);

  const status = connecting
    ? "Connecting…"
    : connected
      ? `Connected to ${device?.name ?? device?.address}`
      : "Not connected";

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.heroSection}>
          <AnimatedIcon />
          <ThemedView
            style={{
              flex: 1,
              justifyContent: "center",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <View style={{ flex: 1 }} />
            <GaugeComp value={volume} color="#fff" />
            <Text style={styles.status}>{status}</Text>
            <ThemedView style={{ flexDirection: "row", flex: 1 }}>
              <Host style={styles.host}>
                <Box
                  modifiers={[fillMaxSize()]}
                  floatingToolbarExitAlwaysScrollBehavior="bottom"
                >
                  <HorizontalFloatingToolbar
                    variant="vibrant"
                    modifiers={[align("bottomCenter"), offset(0, -16)]}
                  >
                    <IconButton
                      modifiers={[size(68, 60)]}
                      onClick={() => MediaKeys.playPause()}
                    >
                      <Icon
                        size={56}
                        source={require("../../assets/images/play_pause.png")}
                      />
                    </IconButton>
                    <IconButton
                      modifiers={[size(68, 60)]}
                      onClick={openPicker}
                    >
                      {connected ? (
                        <Icon
                          size={36}
                          source={require("../../assets/images/connected.png")}
                        />
                      ) : (
                        <Icon
                          size={36}
                          source={require("../../assets/images/not_connected.png")}
                        />
                      )}
                    </IconButton>
                    <HorizontalFloatingToolbar.FloatingActionButton
                      onPress={() => MediaKeys.next()}
                    >
                      <Icon
                        size={36}
                        source={require("../../assets/images/skip_next.png")}
                      />
                    </HorizontalFloatingToolbar.FloatingActionButton>
                  </HorizontalFloatingToolbar>
                </Box>
              </Host>
            </ThemedView>
          </ThemedView>
        </ThemedView>
      </SafeAreaView>

      {/* outside Host / SafeAreaView on purpose */}
      <DevicePickerModal
        visible={visible}
        devices={devices}
        connectedAddress={device?.address ?? null}
        onSelect={(d) => {
          setVisible(false);
          connectDevice(d);
        }}
        onDisconnect={disconnectDevice}
        onClose={() => setVisible(false)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    flexDirection: "row",
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    alignItems: "center",
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
  },
  heroSection: {
    padding: 50,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    flex: 1,
  },
  host: {
    flex: 1,
    alignSelf: "stretch",
    width: "100%",
  },
  status: {
    color: "#9a9a9a",
    fontSize: 14,
    marginTop: 12,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  dialog: {
    backgroundColor: "#19191a",
    width: "100%",
    maxWidth: 440,
    maxHeight: "75%",
    borderRadius: 20,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#3a3a3c",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  closeButton: {
    fontSize: 20,
    color: "#9a9a9a",
    paddingHorizontal: 4,
  },
  disconnectRow: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#3a3a3c",
  },
  disconnectText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ff6b6b",
  },
  list: {
    flexGrow: 0,
    flexShrink: 1,
  },
  item: {
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  itemContent: {
    gap: 4,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#f2f2f2",
  },
  subtitle: {
    fontSize: 13,
    color: "#9a9a9a",
  },
  empty: {
    color: "#9a9a9a",
    padding: 18,
    fontSize: 14,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#3a3a3c",
  },
});
