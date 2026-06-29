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
// Produccion (la nube): https://.vercel.app
// Pruebas en tu PC:      http://192.168.x.x:3000   (detecta http/https solo)
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

// ---- Buzzer (igual pin que DispensadorFirme) ----
const int BUZZER = 21;  // GPIO 21

// ======================================================
// PARAMETROS
// ======================================================
const float DISTANCIA_PERRO = 20.0;             // cm: a esta distancia "el perro esta cerca"
float pesoObjetivo = 250.0;                     // g por racion (el server lo confirma)
const unsigned long HEARTBEAT_MS = 1500;        // cada cuanto reporta al server
const unsigned long TIMEOUT_ALIMENTAR_MS = 20000; // seguridad: corta a los 20s

// ======================================================
// OBJETOS / ESTADO
// ======================================================
Servo compuerta;
HX711_ADC LoadCell(HX711_dout, HX711_sck);
float calibrationValue = -395.39;

bool alimentando = false;
bool servoManualAbierto = false; // compuerta abierta por "Servir (forzar)"
unsigned long ultimoHeartbeat = 0;

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
  LoadCell.start(2000, true); // estabiliza 2s y hace tare
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
//   Solo mide y reporta. NO abre solo: espera el comando
//   "alimentar" que el usuario envia desde la app.
// ======================================================
void loop() {
  LoadCell.update();

  float distancia = medirDistancia();
  float pesoReal  = LoadCell.getData() * (-1);
  bool  perroCerca = (distancia > 0 && distancia <= DISTANCIA_PERRO);

  if (millis() - ultimoHeartbeat >= HEARTBEAT_MS) {
    ultimoHeartbeat = millis();

    // Estado en vivo para el Serial Monitor
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

      // Servo manual (boton "Servir (forzar)" / "Cerrar"). Tiene prioridad.
      // El manual NO activa el buzzer: no es hora de comer, es una servida forzada.
      if (!alimentando && !servoManualAbierto && resp.indexOf("\"abrir\":true") >= 0) {
        Serial.println("  ->  ABRIR manual");
        abrirManual();
      } else if (servoManualAbierto && resp.indexOf("\"cerrar\":true") >= 0) {
        Serial.println("  ->  CERRAR manual");
        cerrarManual();
      }
      // Alimentacion programada: el server dice que es la hora. Primero suena el buzzer.
      else if (!alimentando && !servoManualAbierto &&
               resp.indexOf("\"alimentar\":true") >= 0) {
        Serial.println("  ->  HORA DE COMER");
        sonarHoraDeComida();
        alimentar();
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
// ESTADO: parsea el JSON del server e imprime cada campo
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
  int end = json.indexOf("\"", start);
  return (end > start) ? json.substring(start, end) : "";
}

void imprimirEstado(const String& resp, bool perroCercaLocal) {
  bool   alimentar  = extraerBool(resp, "alimentar");
  bool   nearServer = extraerBool(resp, "_near");
  bool   abrir      = extraerBool(resp, "abrir");
  bool   cerrar     = extraerBool(resp, "cerrar");
  String horaLima   = extraerString(resp, "_t");
  String proxComida = extraerString(resp, "_next");

  Serial.println("------------------------------");
  Serial.print("  Hora servidor: "); Serial.println(horaLima.length() ? horaLima : "?");
  Serial.print("  Prox. comida : "); Serial.println(proxComida.length() ? proxComida : "?");
  Serial.print("  Perro cerca  : "); Serial.print(perroCercaLocal ? "SI" : "NO");
  Serial.print("  (server: "); Serial.print(nearServer ? "SI" : "NO"); Serial.println(")");
  Serial.print("  Hora comer   : "); Serial.println(alimentar ? "SI  <<< ALIMENTAR" : "NO");
  Serial.print("  Peso obj.    : "); Serial.print(pesoObjetivo, 0); Serial.println(" g");
  if (abrir)  Serial.println("  Orden manual : ABRIR");
  if (cerrar) Serial.println("  Orden manual : CERRAR");
  Serial.println("------------------------------");
}

// ======================================================
// BUZZER: avisa que es hora de comer (3 pitidos cortos)
//   Se llama ANTES de abrir la compuerta, no durante la servida.
// ======================================================
void sonarHoraDeComida() {
  Serial.println("Hora de comer -> buzzer");
  for (int i = 0; i < 3; i++) {
    digitalWrite(BUZZER, HIGH);
    delay(180);
    digitalWrite(BUZZER, LOW);
    delay(120);
  }
}

// ======================================================
// ALIMENTAR: abre, dispensa hasta el peso, cierra y reporta
// ======================================================
void alimentar() {
  Serial.println("Comando ALIMENTAR -> abriendo compuerta");
  alimentando = true;

  LoadCell.update();
  LoadCell.tare();        // pone el peso en cero antes de servir
  delay(300);
  compuerta.write(ANGULO_ABIERTO);

  unsigned long inicio = millis();
  unsigned long ultimoAviso = 0;
  float pesoReal = 0;

  while (true) {
    LoadCell.update();
    pesoReal = LoadCell.getData() * (-1);

    if (pesoReal >= pesoObjetivo) break;                       // listo
    if (millis() - inicio > TIMEOUT_ALIMENTAR_MS) {            // seguridad
      Serial.println("Timeout de seguridad al alimentar");
      break;
    }

    // Avisa el peso en vivo (~cada 600ms) para que la app muestre el progreso.
    if (millis() - ultimoAviso > 600) {
      ultimoAviso = millis();
      enviarHeartbeat(true, pesoReal, 0);
    }
    delay(40);
  }

  compuerta.write(ANGULO_CERRADO);
  Serial.print("Servido: ");
  Serial.print(pesoReal);
  Serial.println(" g  -> compuerta cerrada");

  // Reporta cuanto sirvio.
  String payload = String("{\"gramos\":") + String(pesoReal, 1) + "}";
  postJson("/api/dispositivo/resultado", payload);

  ultimoHeartbeat = millis();
  alimentando = false;
}

// ======================================================
// SERVO MANUAL: abrir y mantener / cerrar bajo demanda
//   No bloquea: la compuerta queda abierta y el loop sigue
//   reportando el peso en vivo hasta que llegue "cerrar".
//   No suena el buzzer: no es un horario programado.
// ======================================================
void abrirManual() {
  Serial.println("Comando ABRIR (manual) -> compuerta abierta");
  servoManualAbierto = true;
  LoadCell.update();
  LoadCell.tare(); // cuenta desde cero lo que se sirva manualmente
  delay(200);
  compuerta.write(ANGULO_ABIERTO);
}

void cerrarManual() {
  LoadCell.update();
  float pesoReal = LoadCell.getData() * (-1);
  compuerta.write(ANGULO_CERRADO);
  servoManualAbierto = false;

  Serial.print("Cierre manual. Servido: ");
  Serial.print(pesoReal);
  Serial.println(" g  -> compuerta cerrada");

  String payload = String("{\"gramos\":") + String(pesoReal, 1) + "}";
  postJson("/api/dispositivo/resultado", payload);
  ultimoHeartbeat = millis();
}

// ======================================================
// HEARTBEAT: reporta estado y devuelve la respuesta del server
// ======================================================
String enviarHeartbeat(bool perroCerca, float peso, float distancia) {
  String payload = String("{\"perroCerca\":") + (perroCerca ? "true" : "false") +
                   ",\"peso\":" + String(peso, 1) +
                   ",\"distancia\":" + String(distancia, 1) + "}";
  return postJson("/api/dispositivo/heartbeat", payload);
}

// Extrae "pesoObjetivo" de la respuesta del server (sin libreria JSON).
void actualizarObjetivo(const String& resp) {
  int i = resp.indexOf("\"pesoObjetivo\":");
  if (i >= 0) {
    float v = resp.substring(i + 15).toFloat();
    if (v > 0) pesoObjetivo = v;
  }
}

// ======================================================
// POST JSON  (detecta http/https segun API_BASE)
//   Devuelve el cuerpo de la respuesta ("" si falla).
// ======================================================
String postJson(const char* ruta, const String& payload) {
  // Reconecta WiFi si hace falta
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

  bool iniciado = false;
  WiFiClientSecure clientS;
  WiFiClient clientP;

  if (url.startsWith("https")) {
    clientS.setInsecure(); // no valida certificado (suficiente para el proyecto)
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
      Serial.print("Error HTTP en ");
      Serial.print(ruta);
      Serial.print(": ");
      Serial.println(HTTPClient::errorToString(code));
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
