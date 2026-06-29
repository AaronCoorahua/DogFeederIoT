#include <HX711_ADC.h>
#include <ESP32Servo.h>

// ======================================================
// WIFI + API  (WiFi.h, HTTPClient.h y WiFiClientSecure.h
// YA VIENEN con el paquete de placas ESP32. No instalas nada.)
// ======================================================
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

// ---- Credenciales WiFi ----
const char* WIFI_SSID     = "Iphone Aaron";
const char* WIFI_PASSWORD = "aaron123";

// ---- URL base de la app (SIN barra final, SIN ruta) ----
const char* API_BASE = "https://dog-feeder-io-t.vercel.app";

// ---- Clave compartida (igual a DEVICE_API_KEY en Next.js) ----
const char* API_KEY = "123456789";

// ======================================================
// PINES
// ======================================================
const int servoPin = 18;
const int ANGULO_CERRADO = 0;
const int ANGULO_ABIERTO = 90;

const int HX711_dout = 4;
const int HX711_sck  = 5;

const int TRIG_PIN = 27;
const int ECHO_PIN = 26;

const int BUZZER = 21;

// ======================================================
// TIEMPOS
// ======================================================
const unsigned long HEARTBEAT_MS        = 1500;   // cada cuanto reporta al server
const unsigned long TIMEOUT_ALIMENTAR_MS = 20000; // seguridad: corta alimentacion a los 20s
const unsigned long TIMEOUT_MANUAL_MS   = 120000; // cierra la compuerta manual a los 2 min
const unsigned long INTERVALO_ALARMA_MS = 30000;  // cada 30s suena para llamar al perro

// ======================================================
// PARAMETROS
// ======================================================
const float DISTANCIA_PERRO = 20.0;
float pesoObjetivo = 250.0; // g por racion (el server lo confirma)

// ======================================================
// OBJETOS / ESTADO
// ======================================================
Servo compuerta;
HX711_ADC LoadCell(HX711_dout, HX711_sck);
float calibrationValue = -395.39;

bool alimentando        = false;
bool servoManualAbierto = false;

unsigned long ultimoHeartbeat = 0;
unsigned long ultimaAlarma    = 0; // para no sonar cada 1.5s
unsigned long tiempoManual    = 0; // para timeout de servo manual

// ======================================================
// SETUP
// ======================================================
void setup() {
  Serial.begin(115200);
  delay(1000);

  conectarWiFi();

  compuerta.attach(servoPin);
  compuerta.write(ANGULO_CERRADO);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  pinMode(BUZZER, OUTPUT);
  digitalWrite(BUZZER, LOW);

  LoadCell.begin();
  LoadCell.start(2000, true);
  if (LoadCell.getTareTimeoutFlag()) {
    Serial.println("Error HX711");
    while (1);
  }
  LoadCell.setCalFactor(calibrationValue);

  Serial.println("=================================");
  Serial.println("DISPENSADOR LISTO");
  Serial.println("Reportando estado a la app...");
  Serial.println("=================================");
}

// ======================================================
// LOOP
// ======================================================
void loop() {
  LoadCell.update();

  float distancia  = medirDistancia();
  float pesoReal   = LoadCell.getData() * (-1);
  bool  perroCerca = (distancia > 0 && distancia <= DISTANCIA_PERRO);

  // --- Timeout de compuerta manual abierta (cierre de seguridad a los 2 min) ---
  if (servoManualAbierto && (millis() - tiempoManual >= TIMEOUT_MANUAL_MS)) {
    Serial.println("[Timeout] Cerrando compuerta manual automaticamente");
    cerrarManual();
  }

  if (millis() - ultimoHeartbeat >= HEARTBEAT_MS) {
    ultimoHeartbeat = millis();

    Serial.print("Dist: ");
    Serial.print(distancia, 1);
    Serial.print(" cm  |  Peso: ");
    Serial.print(pesoReal, 1);
    Serial.print(" g  |  Perro: ");
    Serial.print(perroCerca ? "cerca" : "lejos");

    String resp = enviarHeartbeat(perroCerca, pesoReal, distancia);
    if (resp.length() > 0) {
      actualizarObjetivo(resp);
      imprimirEstado(resp, perroCerca);

      bool abrir    = extraerBool(resp, "abrir");
      bool cerrar   = extraerBool(resp, "cerrar");
      bool alimentar = extraerBool(resp, "alimentar");
      bool alarma   = extraerBool(resp, "_alarma");

      // --- Servo manual (prioridad sobre todo) ---
      if (!alimentando && !servoManualAbierto && abrir) {
        Serial.println("  ->  ABRIR manual");
        abrirManual();
      } else if (servoManualAbierto && cerrar) {
        Serial.println("  ->  CERRAR manual");
        cerrarManual();
      }
      // --- Alimentacion programada: dog ya esta cerca y es hora ---
      else if (!alimentando && !servoManualAbierto && alimentar) {
        Serial.println("  ->  HORA DE COMER (perro cerca)");
        ultimaAlarma = 0; // reset para la proxima comida
        sonarHoraDeComida();
        alimentar_fn();
      }
      // --- Alarma: es hora pero el perro no llego todavia → llamarlo ---
      else if (!alimentando && !servoManualAbierto && alarma) {
        Serial.print("  ->  llamando al perro (slot pendiente)");
        if (millis() - ultimaAlarma >= INTERVALO_ALARMA_MS) {
          ultimaAlarma = millis();
          Serial.println(" -> BUZZER");
          sonarLlamarPerro();
        } else {
          Serial.println(" (esperando intervalo)");
        }
      } else {
        Serial.print("  ->  en espera");
        if (!perroCerca) Serial.print(" (perro no cerca)");
        Serial.println();
      }
    } else {
      Serial.println("  ->  sin respuesta del server");
    }
  }

  delay(50);
}

// ======================================================
// HELPERS DE PARSEO JSON (sin libreria)
// ======================================================
bool extraerBool(const String& json, const char* key) {
  String search = String("\"") + key + "\":true";
  return json.indexOf(search) >= 0;
}
String extraerString(const String& json, const char* key) {
  String search = String("\"") + key + "\":\"";
  int i = json.indexOf(search);
  if (i < 0) return "";
  int start = i + search.length();
  int end   = json.indexOf("\"", start);
  return (end > start) ? json.substring(start, end) : "";
}

// ======================================================
// PRINT DE ESTADO
// ======================================================
void imprimirEstado(const String& resp, bool perroCercaLocal) {
  bool   alimentar  = extraerBool(resp, "alimentar");
  bool   nearServer = extraerBool(resp, "_near");
  bool   alarma     = extraerBool(resp, "_alarma");
  String horaLima   = extraerString(resp, "_t");
  String proxComida = extraerString(resp, "_next");

  Serial.println("------------------------------");
  Serial.print("  Hora servidor: "); Serial.println(horaLima.length()   ? horaLima   : "?");
  Serial.print("  Prox. comida : "); Serial.println(proxComida.length() ? proxComida : "?");
  Serial.print("  Perro cerca  : "); Serial.print(perroCercaLocal ? "SI" : "NO");
  Serial.print("  (server: "); Serial.print(nearServer ? "SI" : "NO"); Serial.println(")");
  Serial.print("  Hora comer   : "); Serial.println(alimentar ? "SI  <<< ALIMENTAR" : "NO");
  if (alarma)   Serial.println("  Alarma       : SI (slot pendiente, perro no cerca)");
  Serial.print("  Peso obj.    : "); Serial.print(pesoObjetivo, 0); Serial.println(" g");
  Serial.println("------------------------------");
}

// ======================================================
// BUZZER
// ======================================================

// 3 pitidos cortos: "es hora, el perro ya esta aqui, abriendo"
void sonarHoraDeComida() {
  Serial.println("Buzzer: hora de comer");
  for (int i = 0; i < 3; i++) {
    digitalWrite(BUZZER, HIGH); delay(180);
    digitalWrite(BUZZER, LOW);  delay(120);
  }
}

// 2 pitidos largos: "ven a comer, perro!" — suena SIN necesitar que el perro este cerca
void sonarLlamarPerro() {
  Serial.println("Buzzer: llamando al perro");
  for (int i = 0; i < 2; i++) {
    digitalWrite(BUZZER, HIGH); delay(500);
    digitalWrite(BUZZER, LOW);  delay(300);
  }
}

// ======================================================
// ALIMENTAR (renombrado internamente para evitar conflicto con el bool)
// ======================================================
void alimentar_fn() {
  Serial.println("Comando ALIMENTAR -> abriendo compuerta");
  alimentando = true;

  LoadCell.update();
  LoadCell.tare();
  delay(300);
  compuerta.write(ANGULO_ABIERTO);

  unsigned long inicio     = millis();
  unsigned long ultimoAviso = 0;
  float pesoReal = 0;

  while (true) {
    LoadCell.update();
    pesoReal = LoadCell.getData() * (-1);

    if (pesoReal >= pesoObjetivo) break;
    if (millis() - inicio > TIMEOUT_ALIMENTAR_MS) {
      Serial.println("Timeout de seguridad al alimentar");
      break;
    }
    if (millis() - ultimoAviso > 600) {
      ultimoAviso = millis();
      enviarHeartbeat(true, pesoReal, 0);
    }
    delay(40);
  }

  compuerta.write(ANGULO_CERRADO);
  Serial.print("Servido: "); Serial.print(pesoReal); Serial.println(" g -> compuerta cerrada");

  String payload = String("{\"gramos\":") + String(pesoReal, 1) + "}";
  postJson("/api/dispositivo/resultado", payload);

  ultimoHeartbeat = millis();
  alimentando     = false;
}

// ======================================================
// SERVO MANUAL
// ======================================================
void abrirManual() {
  Serial.println("Comando ABRIR (manual) -> compuerta abierta");
  servoManualAbierto = true;
  tiempoManual = millis(); // inicia el timeout de seguridad
  LoadCell.update();
  LoadCell.tare();
  delay(200);
  compuerta.write(ANGULO_ABIERTO);
}

void cerrarManual() {
  LoadCell.update();
  float pesoReal = LoadCell.getData() * (-1);
  compuerta.write(ANGULO_CERRADO);
  servoManualAbierto = false;
  tiempoManual = 0;

  Serial.print("Cierre manual. Servido: "); Serial.print(pesoReal); Serial.println(" g");

  String payload = String("{\"gramos\":") + String(pesoReal, 1) + "}";
  postJson("/api/dispositivo/resultado", payload);
  ultimoHeartbeat = millis();
}

// ======================================================
// HEARTBEAT
// ======================================================
String enviarHeartbeat(bool perroCerca, float peso, float distancia) {
  String payload = String("{\"perroCerca\":") + (perroCerca ? "true" : "false") +
                   ",\"peso\":" + String(peso, 1) +
                   ",\"distancia\":" + String(distancia, 1) + "}";
  return postJson("/api/dispositivo/heartbeat", payload);
}

void actualizarObjetivo(const String& resp) {
  int i = resp.indexOf("\"pesoObjetivo\":");
  if (i >= 0) {
    float v = resp.substring(i + 15).toFloat();
    if (v > 0) pesoObjetivo = v;
  }
}

// ======================================================
// POST JSON
// ======================================================
String postJson(const char* ruta, const String& payload) {
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.reconnect();
    unsigned long t = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - t < 4000) delay(150);
    if (WiFi.status() != WL_CONNECTED) return "";
  }

  String url = String(API_BASE) + ruta;
  String respuesta = "";
  HTTPClient http;
  http.setConnectTimeout(5000);
  http.setTimeout(5000);

  WiFiClientSecure clientS;
  WiFiClient clientP;
  bool iniciado = false;

  if (url.startsWith("https")) {
    clientS.setInsecure();
    iniciado = http.begin(clientS, url);
  } else {
    iniciado = http.begin(clientP, url);
  }

  if (iniciado) {
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-api-key", API_KEY);
    int code = http.POST(payload);
    if (code > 0) {
      respuesta = http.getString();
    } else {
      Serial.print("Error HTTP en "); Serial.print(ruta);
      Serial.print(": "); Serial.println(HTTPClient::errorToString(code));
    }
    http.end();
  }
  return respuesta;
}

// ======================================================
// MEDIR DISTANCIA HC-SR04
// ======================================================
float medirDistancia() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duracion = pulseIn(ECHO_PIN, HIGH, 30000);
  if (duracion == 0) return 999;
  return duracion * 0.0343 / 2.0;
}

// ======================================================
// CONECTAR A WIFI
// ======================================================
void conectarWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("Conectando a WiFi");
  unsigned long inicio = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - inicio < 15000) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.print("WiFi conectado. IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println();
    Serial.println("No se pudo conectar a WiFi (seguira intentando al reportar).");
  }
}
