#include <Arduino.h>
#include <Preferences.h>
#include "BluetoothSerial.h"

#if !defined(CONFIG_BT_ENABLED) || !defined(CONFIG_BLUEDROID_ENABLED)
#error Bluetooth is not enabled! Please run `make menuconfig` and enable it
#endif
#if !defined(CONFIG_BT_SPP_ENABLED)
#error Serial Bluetooth not available or not enabled. It is only available for the ESP32 chip.
#endif

#define DEVICE_NAME           "0xHSC"
#define SAVED_TRY_COUNT       3        // connect attempts to the saved device at boot
#define RETRY_SAVED_EVERY_MS  20000    // later retries while idle (0 = never retry)
#define AFTER_DROP_DELAY_MS   2000     // pause before retrying after a disconnect

BluetoothSerial SerialBT;
Preferences prefs;

String   savedMac = "";
uint32_t nextTry  = 0;

volatile bool evtOpened = false;
volatile bool evtClosed = false;
uint8_t       evtPeer[6];


void sppCallback(esp_spp_cb_event_t event, esp_spp_cb_param_t *param) {
  switch (event) {
    case ESP_SPP_SRV_OPEN_EVT:
      if (param->srv_open.status == ESP_SPP_SUCCESS) {
        memcpy(evtPeer, param->srv_open.rem_bda, 6);
        __sync_synchronize();
        evtOpened = true;
      }
      break;
    case ESP_SPP_OPEN_EVT:
      if (param->open.status == ESP_SPP_SUCCESS) {
        memcpy(evtPeer, param->open.rem_bda, 6);
        __sync_synchronize();
        evtOpened = true;
      }
      break;
    case ESP_SPP_CLOSE_EVT:
      evtClosed = true;
      break;
    default:
      break;
  }
}

void loadSavedMac() {
  prefs.begin("bt", true);
  savedMac = prefs.getString("mac", "");
  prefs.end();
}

void saveMac(BTAddress addr) {
  String mac = String(addr.toString().c_str());
  if (mac == savedMac) return;
  prefs.begin("bt", false);
  prefs.putString("mac", mac);
  prefs.end();
  savedMac = mac;
  Serial.printf("[info]: saved device %s\n", mac.c_str());
}

void startDiscoverMode() {
  // visible to phones and accepting connections
  esp_bt_gap_set_scan_mode(ESP_BT_CONNECTABLE, ESP_BT_GENERAL_DISCOVERABLE);
  Serial.println("[info]: discoverable, waiting for a device to pair/connect");
}

bool tryConnectSaved() {
  unsigned int b[6];
  if (sscanf(savedMac.c_str(), "%x:%x:%x:%x:%x:%x", &b[0], &b[1], &b[2], &b[3], &b[4], &b[5]) != 6) {
    return false;
  }
  uint8_t addr[6];
  for (int i = 0; i < 6; i++) addr[i] = (uint8_t)b[i];

  Serial.printf("[info]: connecting to saved device %s\n", savedMac.c_str());
  bool ok = SerialBT.connect(addr);
  if (!ok && !SerialBT.hasClient()) {
    Serial.println("[warn]: saved device not reachable");
  }
  return ok || SerialBT.hasClient();
}

void handleEvents() {
  if (evtOpened) {
    evtOpened = false;
    BTAddress peer(evtPeer);
    Serial.printf("[info]: connected: %s\n", peer.toString().c_str());
    saveMac(peer);
  }
  if (evtClosed) {
    evtClosed = false;
    if (!SerialBT.hasClient()) {
      Serial.println("[info]: disconnected");
      startDiscoverMode();
      nextTry = millis() + AFTER_DROP_DELAY_MS;
    }
  }
}


void setup() {
  Serial.begin(115200);

  SerialBT.register_callback(sppCallback);
  if (!SerialBT.begin(DEVICE_NAME, true, false)) {
    Serial.println("[error]: failed to begin the bluetooth initialization");
    abort();
  }

  loadSavedMac();
  startDiscoverMode();

  if (savedMac.length()) {
    Serial.printf("[info]: last device: %s\n", savedMac.c_str());
    for (int i = 0; i < SAVED_TRY_COUNT && !SerialBT.hasClient(); i++) {
      if (tryConnectSaved()) break;
      delay(1000);
    }
  } else {
    Serial.println("[info]: no saved device");
  }
  nextTry = millis() + RETRY_SAVED_EVERY_MS;
}

void loop() {
  handleEvents();

  if (SerialBT.hasClient()) {
    while (SerialBT.available()) Serial.write(SerialBT.read());
    while (Serial.available())   SerialBT.write(Serial.read());
    delay(2);
    return;
  }

  if (savedMac.length() && RETRY_SAVED_EVERY_MS > 0 && (int32_t)(millis() - nextTry) >= 0) {
    tryConnectSaved();
    nextTry = millis() + RETRY_SAVED_EVERY_MS;
  }
  delay(50);
}