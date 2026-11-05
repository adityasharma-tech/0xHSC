
#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

#define POT_PIN        34
#define PLAY_PIN       26
#define PAUSE_PIN      27
#define LED_PIN        2

#define DEVICE_NAME           "0xHSC"
#define AFTER_DROP_DELAY_MS   2000
#define RESET_HOLD_MS         3000
#define DEBOUNCE_MS           30
#define POT_INTERVAL_MS       20
#define POT_DEADBAND          20
#define POT_MIN               150
#define POT_MAX               3950

#define SERVICE_UUID \
  "6e400001-b5a3-f393-e0a9-e50e24dcca9e"

#define RX_CHARACTERISTIC_UUID \
  "6e400002-b5a3-f393-e0a9-e50e24dcca9e"

#define TX_CHARACTERISTIC_UUID \
  "6e400003-b5a3-f393-e0a9-e50e24dcca9e"

BLEServer *bleServer = nullptr;
BLECharacteristic *txCharacteristic = nullptr;
BLECharacteristic *rxCharacteristic = nullptr;

volatile bool deviceConnected = false;
volatile bool advertisingRestartPending = false;

uint32_t nextTry = 0;

struct Button {
  uint8_t pin;
  bool stable;
  bool lastRaw;
  uint32_t changedAt;
};

Button btnPlay  = { PLAY_PIN, false, false, 0 };
Button btnPause = { PAUSE_PIN, false, false, 0 };


class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *server) override {
    deviceConnected = true;
    advertisingRestartPending = false;
    Serial.println("[info]: BLE client connected");
  }

  void onDisconnect(BLEServer *server) override {
    deviceConnected = false;
    advertisingRestartPending = true;
    Serial.println("[info]: BLE client disconnected");
  }
};


class RXCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *characteristic) override {
    std::string value = characteristic->getValue();

    if (!value.empty()) {
      Serial.print("[BLE RX]: ");
      Serial.println(value.c_str());
    }
  }
};


void startAdvertising() {
  BLEAdvertising *advertising = BLEDevice::getAdvertising();

  advertising->addServiceUUID(SERVICE_UUID);
  advertising->setScanResponse(true);
  advertising->setMinPreferred(0x06);
  advertising->setMinPreferred(0x12);

  BLEDevice::startAdvertising();

  Serial.println("[info]: BLE advertising started");
}


void handleBleEvents() {
  if (advertisingRestartPending) {
    advertisingRestartPending = false;

    delay(AFTER_DROP_DELAY_MS);
    startAdvertising();
  }
}


void sendCmd(const char *cmd) {
  if (deviceConnected && txCharacteristic) {
    String message = String(cmd) + "\n";

    txCharacteristic->setValue(
      (uint8_t *)message.c_str(),
      message.length()
    );

    txCharacteristic->notify();
  }

  Serial.printf(
    "[info]: cmd %s%s\n",
    cmd,
    deviceConnected ? "" : " (not connected)"
  );
}


void resetBluetooth() {
  Serial.println("[info]: RESET: restarting BLE controller");

  digitalWrite(LED_PIN, HIGH);

  BLEDevice::deinit(true);

  for (int i = 0; i < 10; i++) {
    digitalWrite(LED_PIN, i & 1);
    delay(100);
  }

  ESP.restart();
}


bool updateButton(Button &b) {
  bool raw = (digitalRead(b.pin) == LOW);

  if (raw != b.lastRaw) {
    b.lastRaw = raw;
    b.changedAt = millis();
  }

  if (
    raw != b.stable &&
    millis() - b.changedAt >= DEBOUNCE_MS
  ) {
    b.stable = raw;
    return true;
  }

  return false;
}


void handleButtons() {
  static bool comboSeen = false;
  static uint32_t comboStart = 0;

  bool playChanged = updateButton(btnPlay);
  bool pauseChanged = updateButton(btnPause);

  if (btnPlay.stable && btnPause.stable) {
    comboSeen = true;

    if (!comboStart) {
      comboStart = millis();
    }

    if (millis() - comboStart >= RESET_HOLD_MS) {
      resetBluetooth();
    }
  } else {
    comboStart = 0;
  }

  if (
    playChanged &&
    !btnPlay.stable &&
    !comboSeen
  ) {
    sendCmd("P");
  }

  if (
    pauseChanged &&
    !btnPause.stable &&
    !comboSeen
  ) {
    sendCmd("S");
  }

  if (!btnPlay.stable && !btnPause.stable) {
    comboSeen = false;
  }
}


int potSent = 0;
int lastPct = -1;


int readPotRaw() {
  uint32_t sum = 0;

  for (int i = 0; i < 8; i++) {
    sum += analogRead(POT_PIN);
  }

  return sum / 8;
}


int rawToPercent(int raw) {
  return map(
    constrain(raw, POT_MIN, POT_MAX),
    POT_MIN,
    POT_MAX,
    0,
    100
  );
}


void handlePot() {
  static uint32_t last = 0;

  if (millis() - last < POT_INTERVAL_MS) {
    return;
  }

  last = millis();

  int raw = readPotRaw();
  int pct = rawToPercent(raw);

  bool atEnd = (pct == 0 || pct == 100);

  if (
    abs(raw - potSent) < POT_DEADBAND &&
    !(atEnd && pct != lastPct)
  ) {
    return;
  }

  potSent = raw;
  lastPct = pct;

  if (deviceConnected && txCharacteristic) {
    char message[12];

    snprintf(message, sizeof(message), "V:%d\n", pct);

    txCharacteristic->setValue(
      (uint8_t *)message,
      strlen(message)
    );

    txCharacteristic->notify();
  }

  Serial.printf(
    "[info]: volume %d%s\n",
    pct,
    deviceConnected ? "" : " (not connected)"
  );
}


void updateLed() {
  uint32_t t = millis();
  bool on;

  if (deviceConnected) {
    on = (t % 3000) < 60;
  } else {
    on = (t / 250) & 1;
  }

  digitalWrite(LED_PIN, on);
}


void setup() {
  Serial.begin(115200);

  pinMode(PLAY_PIN, INPUT_PULLUP);
  pinMode(PAUSE_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);

  analogReadResolution(12);

  potSent = readPotRaw();
  lastPct = rawToPercent(potSent);

  // Initialize BLE
  BLEDevice::init(DEVICE_NAME);

  bleServer = BLEDevice::createServer();

  bleServer->setCallbacks(new ServerCallbacks());

  // Create Nordic UART service
  BLEService *service =
    bleServer->createService(SERVICE_UUID);

  // TX: ESP32 -> Mobile app (Notify)
  txCharacteristic =
    service->createCharacteristic(
      TX_CHARACTERISTIC_UUID,
      BLECharacteristic::PROPERTY_NOTIFY
    );

  txCharacteristic->addDescriptor(new BLE2902());

  // RX: Mobile app -> ESP32 (Write)
  rxCharacteristic =
    service->createCharacteristic(
      RX_CHARACTERISTIC_UUID,
      BLECharacteristic::PROPERTY_WRITE |
      BLECharacteristic::PROPERTY_WRITE_NR
    );

  rxCharacteristic->setCallbacks(new RXCallbacks());

  service->start();

  startAdvertising();

  Serial.println("[info]: 0xHSC BLE controller ready");
}


void loop() {
  handleBleEvents();
  handleButtons();
  handlePot();
  updateLed();

  delay(2);
}
