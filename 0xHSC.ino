#include <Arduino.h>
#include <Preferences.h>
#include "BluetoothSerial.h"

#if !defined(CONFIG_BT_ENABLED) || !defined(CONFIG_BLUEDROID_ENABLED)
#error Bluetooth is not enabled! Please run `make menuconfig` and enable it
#endif
#if !defined(CONFIG_BT_SPP_ENABLED)
#error Serial Bluetooth not available or not enabled. It is only available for the ESP32 chip.
#endif

#define POT_PIN        34 
#define PLAY_PIN       26
#define PAUSE_PIN      27 
#define LED_PIN        2   


#define DEVICE_NAME           "0xHSC"
#define SAVED_TRY_COUNT       3      
#define RETRY_SAVED_EVERY_MS  20000   
#define AFTER_DROP_DELAY_MS   2000
#define RESET_HOLD_MS         3000   
#define DEBOUNCE_MS           30
#define POT_INTERVAL_MS       20
#define POT_DEADBAND          20   
#define POT_MIN               150    
#define POT_MAX               3950

BluetoothSerial SerialBT;
Preferences prefs;

struct Button {
  uint8_t  pin;
  bool     stable;   
  bool     lastRaw;
  uint32_t changedAt;
};

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


void resetBluetooth() {
  Serial.println("[info]: RESET: dropping connection and forgetting all paired devices");
  digitalWrite(LED_PIN, HIGH);

  if (SerialBT.hasClient()) SerialBT.disconnect();  
  SerialBT.deleteAllBondedDevices();

  prefs.begin("bt", false);
  prefs.remove("mac");
  prefs.end();
  savedMac = "";

  for (int i = 0; i < 10; i++) {                   
    digitalWrite(LED_PIN, i & 1);
    delay(100);
  }
  ESP.restart();                                   
}


Button btnPlay  = { PLAY_PIN,  false, false, 0 };
Button btnPause = { PAUSE_PIN, false, false, 0 };

bool updateButton(Button &b) {
  bool raw = (digitalRead(b.pin) == LOW);
  if (raw != b.lastRaw) {
    b.lastRaw = raw;
    b.changedAt = millis();
  }
  if (raw != b.stable && millis() - b.changedAt >= DEBOUNCE_MS) {
    b.stable = raw;
    return true;
  }
  return false;
}

void sendCmd(const char *cmd) {
  if (SerialBT.hasClient()) SerialBT.printf("%s\n", cmd);
  Serial.printf("[info]: cmd %s%s\n", cmd, SerialBT.hasClient() ? "" : " (not connected)");
}

void handleButtons() {
  static bool     comboSeen  = false;
  static uint32_t comboStart = 0;

  bool playChanged  = updateButton(btnPlay);
  bool pauseChanged = updateButton(btnPause);

  if (btnPlay.stable && btnPause.stable) {
    comboSeen = true;
    if (!comboStart) comboStart = millis();
    if (millis() - comboStart >= RESET_HOLD_MS) resetBluetooth();  
  } else {
    comboStart = 0;
  }


  if (playChanged  && !btnPlay.stable  && !comboSeen) sendCmd("P");
  if (pauseChanged && !btnPause.stable && !comboSeen) sendCmd("S");

  if (!btnPlay.stable && !btnPause.stable) comboSeen = false;
}


int potSent = 0;
int lastPct = -1;

int readPotRaw() {
  uint32_t sum = 0;
  for (int i = 0; i < 8; i++) sum += analogRead(POT_PIN);
  return sum / 8;
}

int rawToPercent(int raw) {
  return map(constrain(raw, POT_MIN, POT_MAX), POT_MIN, POT_MAX, 0, 100);
}

void handlePot() {
  static uint32_t last = 0;
  if (millis() - last < POT_INTERVAL_MS) return;
  last = millis();

  int raw = readPotRaw();
  int pct = rawToPercent(raw);
  bool atEnd = (pct == 0 || pct == 100);

  if (abs(raw - potSent) < POT_DEADBAND && !(atEnd && pct != lastPct)) return;

  potSent = raw;
  lastPct = pct;
  if (SerialBT.hasClient()) SerialBT.printf("V:%d\n", pct);
  Serial.printf("[info]: volume %d%s\n", pct, SerialBT.hasClient() ? "" : " (not connected)");
}


void updateLed() {
  uint32_t t = millis();
  bool on;

  if (SerialBT.hasClient()) {
    on = (t % 3000) < 60;             
  } else if (savedMac.length()) {
    uint32_t p = t % 2000;            
    on = (p < 100) || (p >= 250 && p < 350);
  } else {
    on = (t / 250) & 1;               
  }

  digitalWrite(LED_PIN, on);
}


void setup() {
  Serial.begin(115200);
  pinMode(PLAY_PIN,  INPUT_PULLUP);
  pinMode(PAUSE_PIN, INPUT_PULLUP);
  pinMode(LED_PIN,   OUTPUT);
  analogReadResolution(12);

  potSent = readPotRaw();           
  lastPct = rawToPercent(potSent);

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
      updateLed();
      if (tryConnectSaved()) break;
      handleButtons();                
      delay(1000);
    }
  } else {
    Serial.println("[info]: no saved device");
  }
  nextTry = millis() + RETRY_SAVED_EVERY_MS;
}

void loop() {
  handleEvents();
  handleButtons();
  handlePot();
  updateLed();

  while (SerialBT.available()) Serial.write(SerialBT.read()); 

  if (!SerialBT.hasClient() && savedMac.length() && RETRY_SAVED_EVERY_MS > 0 &&
      (int32_t)(millis() - nextTry) >= 0) {
    tryConnectSaved();
    nextTry = millis() + RETRY_SAVED_EVERY_MS;
  }
  delay(2);
}