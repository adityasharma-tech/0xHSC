
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  SafeAreaView,
} from "react-native";
import RNBluetoothClassic from "react-native-bluetooth-classic";

export default function BluetoothScreen() {
  const [devices, setDevices] = useState<any[]>([]);
  const [device, setDevice] = useState<any>(null);
  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Find already-paired Bluetooth devices
  const loadDevices = async () => {
    try {
      const paired = await RNBluetoothClassic.getBondedDevices();
      setDevices(paired);
    } catch (error: any) {
      Alert.alert(
        "Bluetooth Error",
        error?.message ?? "Could not load paired devices"
      );
    }
  };

  // Connect to the selected ESP32
  const connectDevice = async (selectedDevice: any) => {
    setLoading(true);

    try {
      const alreadyConnected = await selectedDevice.isConnected();

      if (!alreadyConnected) {
        await selectedDevice.connect({
          DELIMITER: "\n",
        });
      }

      setDevice(selectedDevice);
      setConnected(true);

      setLogs((prev) => [
        ...prev,
        `Connected to ${selectedDevice.name || selectedDevice.address}`,
      ]);
    } catch (error: any) {
      Alert.alert(
        "Connection Failed",
        error?.message ?? "Unable to connect to ESP32"
      );
    } finally {
      setLoading(false);
    }
  };

  // Listen for serial data from ESP32
  useEffect(() => {
    if (!connected || !device) return;

    const subscription = device.onDataReceived((event: any) => {
      const received = String(event.data ?? "");

      setLogs((prev) => [...prev, `ESP32: ${received}`]);
    });

    return () => {
      subscription.remove();
    };
  }, [connected, device]);

  // Send serial data to ESP32
  const sendData = async () => {
    if (!device || !connected) {
      Alert.alert("Not connected", "Connect to ESP32 first.");
      return;
    }

    if (!message.trim()) return;

    try {
      await device.write(message + "\n");

      setLogs((prev) => [...prev, `You: ${message}`]);
      setMessage("");
    } catch (error: any) {
      Alert.alert(
        "Send Failed",
        error?.message ?? "Could not send data"
      );
    }
  };

  // Disconnect from ESP32
  const disconnectDevice = async () => {
    try {
      if (device) {
        await device.disconnect();
      }
    } catch (error) {
      console.warn("Disconnect error:", error);
    } finally {
      setConnected(false);
      setDevice(null);
      setLogs((prev) => [...prev, "Disconnected"]);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>ESP32 Serial Terminal</Text>

      <View style={styles.statusCard}>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: connected ? "#22c55e" : "#ef4444" },
          ]}
        />
        <Text style={styles.statusText}>
          {connected
            ? `Connected: ${device?.name || device?.address}`
            : "Not connected"}
        </Text>
      </View>

      {!connected ? (
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.heading}>Paired devices</Text>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={loadDevices}
            >
              <Text style={styles.buttonText}>Refresh</Text>
            </TouchableOpacity>
          </View>

          {devices.length === 0 ? (
            <Text style={styles.muted}>
              No paired devices. Pair your ESP32 in Android Bluetooth
              settings first.
            </Text>
          ) : (
            devices.map((item) => (
              <View style={styles.deviceRow} key={item.address}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.deviceName}>
                    {item.name || "Unknown device"}
                  </Text>
                  <Text style={styles.muted}>{item.address}</Text>
                </View>

                <TouchableOpacity
                  style={styles.connectButton}
                  disabled={loading}
                  onPress={() => connectDevice(item)}
                >
                  <Text style={styles.buttonText}>
                    {loading ? "Connecting..." : "Connect"}
                  </Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      ) : (
        <TouchableOpacity
          style={styles.disconnectButton}
          onPress={disconnectDevice}
        >
          <Text style={styles.buttonText}>Disconnect</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.heading}>Serial Output</Text>

      <ScrollView
        style={styles.terminal}
        contentContainerStyle={styles.terminalContent}
      >
        {logs.map((line, index) => (
          <Text key={index} style={styles.logText}>
            {line}
          </Text>
        ))}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Enter serial message..."
          placeholderTextColor="#9ca3af"
          value={message}
          onChangeText={setMessage}
          editable={connected}
          onSubmitEditing={sendData}
          returnKeyType="send"
        />

        <TouchableOpacity
          style={[
            styles.sendButton,
            !connected && styles.disabledButton,
          ]}
          onPress={sendData}
          disabled={!connected}
        >
          <Text style={styles.buttonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
    marginVertical: 16,
  },
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 10,
    marginBottom: 20,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  statusText: {
    color: "#111827",
    fontWeight: "600",
    flex: 1,
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  heading: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 12,
  },
  deviceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  deviceName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  muted: {
    color: "#6b7280",
    fontSize: 12,
    marginTop: 4,
  },
  connectButton: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    marginLeft: 8,
  },
  refreshButton: {
    backgroundColor: "#4b5563",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  disconnectButton: {
    backgroundColor: "#dc2626",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 20,
  },
  terminal: {
    flex: 1,
    backgroundColor: "#111827",
    borderRadius: 10,
    marginBottom: 14,
  },
  terminalContent: {
    padding: 12,
  },
  logText: {
    color: "#86efac",
    fontSize: 13,
    marginBottom: 6,
    fontFamily: "monospace",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  input: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: "#111827",
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: "#16a34a",
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 8,
  },
  disabledButton: {
    opacity: 0.4,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
});
