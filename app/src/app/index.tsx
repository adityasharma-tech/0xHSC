import {
  Alert,
  AppState,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect } from "react";
import { Device } from "react-native-ble-plx";
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
import { align, fillMaxSize, size } from "@expo/ui/jetpack-compose/modifiers";
import MediaKeys from "../../modules/media-keys";
import { useBle } from "@/services/store";
import {
  disconnectDevice,
  selectDevice,
  startBle,
  startPickerScan,
  stopPickerScan,
} from "@/services/ble";

const ESP_NAME = "0xHSC";

type PickerProps = {
  visible: boolean;
  scanning: boolean;
  devices: Device[];
  connectedId: string | null;
  onSelect: (device: Device) => void;
  onDisconnect: () => void;
  onClose: () => void;
};

function DevicePickerModal({
  visible,
  scanning,
  devices,
  connectedId,
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
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.dialog}>
          <View style={styles.header}>
            <Text style={styles.title}>Nearby Devices</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.closeButton}>✕</Text>
            </Pressable>
          </View>

          {connectedId && (
            <Pressable style={styles.disconnectRow} onPress={onDisconnect}>
              <Text style={styles.disconnectText}>Disconnect</Text>
            </Pressable>
          )}

          <FlatList
            data={devices}
            keyExtractor={(item) => item.id}
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text style={styles.empty}>
                {scanning
                  ? `Searching for ${ESP_NAME} and other BLE devices…`
                  : "No devices found."}
              </Text>
            }
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item }) => (
              <Pressable style={styles.item} onPress={() => onSelect(item)}>
                <View style={styles.itemContent}>
                  <Text style={styles.itemTitle}>
                    {item.name ?? item.localName ?? item.id}
                    {item.id === connectedId ? "  • connected" : ""}
                  </Text>
                  <Text style={styles.subtitle}>{item.id}</Text>
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
  const { connecting, scanning, device, devices, visible, volume, setVisible } =
    useBle((state) => state);

  const connected = device !== null;

  useEffect(() => {
    startBle().then((ok) => {
      if (!ok) {
        Alert.alert(
          "Permission needed",
          "Bluetooth permission is required to talk to the controller.",
        );
      }
    });
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") startBle();
    });
    return () => subscription.remove();
  }, []);

  const openPicker = () => {
    setVisible(true);
    startPickerScan();
  };

  const closePicker = () => {
    setVisible(false);
    stopPickerScan();
  };

  const status = connecting
    ? "Connecting…"
    : connected
      ? `Connected to ${device?.name ?? device?.localName ?? device?.id}`
      : scanning
        ? "Searching…"
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
                    modifiers={[align("bottomCenter")]}
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
                    <IconButton modifiers={[size(68, 60)]} onClick={openPicker}>
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

      <DevicePickerModal
        visible={visible}
        scanning={scanning}
        devices={devices}
        connectedId={device?.id ?? null}
        onSelect={(d) => {
          closePicker();
          selectDevice(d.id);
        }}
        onDisconnect={async () => {
          await disconnectDevice();
          closePicker();
        }}
        onClose={closePicker}
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
