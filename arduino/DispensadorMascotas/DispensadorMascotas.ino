#include <HX711_ADC.h>
#include <ESP32Servo.h>

// ======================================================
// WIFI + API  (NUEVO)
//   WiFi.h, HTTPClient.h y WiFiClientSecure.h YA VIENEN
//   con el paquete de placas ESP32. No instalas nada nuevo.
// ======================================================
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

// ---- Credenciales de tu red WiFi ----
const char* WIFI_SSID     = "TU_WIFI";
const char* WIFI_PASSWORD = "TU_PASSWORD";

// ---- URL de tu API en Next.js (en la nube) ----
// Ejemplo en producción: https://dogfeeder.vercel.app/api/eventos
// Para pruebas en tu PC local usa: http://192.168.x.x:3000/api/eventos
const char* API_URL = "https://TU-APP.vercel.app/api/eventos";

// ---- Clave compartida (debe ser igual a DEVICE_API_KEY en Next.js) ----
const char* API_KEY = "123456789";

// ======================================================
// SERVO
// ======================================================
Servo compuerta;

const int servoPin = 18;

const int ANGULO_CERRADO = 0;
const int ANGULO_ABIERTO = 90;

// ======================================================
// HX711
// ======================================================
const int HX711_dout = 4;
const int HX711_sck  = 5;

HX711_ADC LoadCell(HX711_dout, HX711_sck);

// Factor obtenido en la calibración
float calibrationValue = -395.39;

// ======================================================
// HC-SR04
// ======================================================
const int TRIG_PIN = 27;
const int ECHO_PIN = 26;

// ======================================================
// CONFIGURACIÓN
// ======================================================
const float DISTANCIA_ACTIVACION = 20.0; // cm
float PESO_OBJETIVO = 250.0;             // gramos

bool dispensando = false;

// ======================================================
// SETUP
// ======================================================
void setup() {

  Serial.begin(115200);
  delay(1000);

  // WiFi (NUEVO)
  conectarWiFi();

  // Servo
  compuerta.attach(servoPin);
  compuerta.write(ANGULO_CERRADO);

  // Ultrasonico
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  // HX711
  LoadCell.begin();

  unsigned long stabilizingtime = 2000;
  bool tare = true;

  LoadCell.start(stabilizingtime, tare);

  if (LoadCell.getTareTimeoutFlag()) {
    Serial.println("Error HX711");
    while (1);
  }

  LoadCell.setCalFactor(calibrationValue);

  Serial.println("=================================");
  Serial.println("DISPENSADOR LISTO");
  Serial.println("Esperando mascota...");
  Serial.println("=================================");
}

// ======================================================
// LOOP
// ======================================================
void loop() {

  LoadCell.update();

  float distancia = medirDistancia();
  float peso      = LoadCell.getData();
  float pesoReal  = peso * (-1);   // valor positivo real en gramos

  Serial.print("Distancia: ");
  Serial.print(distancia);
  Serial.print(" cm   ");

  Serial.print("Peso: ");
  Serial.print(pesoReal);
  Serial.println(" g");

  // --------------------------------------------------
  // Detectar mascota
  // --------------------------------------------------
  if (!dispensando &&
      distancia > 0 &&
      distancia <= DISTANCIA_ACTIVACION) {

    Serial.println("Mascota detectada");
    Serial.println("Abriendo compuerta");

    // Reiniciar peso a cero
    LoadCell.tare();

    // Abrir compuerta
    compuerta.write(ANGULO_ABIERTO);

    dispensando = true;

    // NUEVO: avisar a la app que se ABRIO
    enviarEvento("abierto", pesoReal, distancia);

    delay(500);
  }

  // --------------------------------------------------
  // Dispensar comida
  // --------------------------------------------------
  if (dispensando) {

    if (pesoReal >= PESO_OBJETIVO) {

      Serial.println("Peso objetivo alcanzado");

      // Cerrar compuerta
      compuerta.write(ANGULO_CERRADO);

      Serial.println("Compuerta cerrada");

      dispensando = false;

      // NUEVO: avisar a la app que se CERRO
      enviarEvento("cerrado", pesoReal, distancia);

      delay(2000);

      Serial.println("Esperando que la mascota se retire...");

      while (medirDistancia() <= DISTANCIA_ACTIVACION) {
        delay(100);
      }

      Serial.println("Mascota retirada");
      Serial.println("Sistema listo nuevamente");
    }
  }

  delay(100);
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

  if (duracion == 0) {
    return 999;
  }

  float distancia = duracion * 0.0343 / 2.0;

  return distancia;
}

// ======================================================
// CONECTAR A WIFI  (NUEVO)
// ======================================================
void conectarWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("Conectando a WiFi");
  unsigned long inicio = millis();

  // Intenta conectar hasta 15 segundos
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
    Serial.println("No se pudo conectar a WiFi.");
    Serial.println("El dispensador seguira funcionando sin enviar datos.");
  }
}

// ======================================================
// ENVIAR EVENTO A LA API  (NUEVO)
//   tipo: "abierto" o "cerrado"
// ======================================================
void enviarEvento(const char* tipo, float peso, float distancia) {

  // Si se cayo el WiFi, intenta reconectar brevemente
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi desconectado, reintentando...");
    WiFi.reconnect();
    unsigned long inicio = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - inicio < 5000) {
      delay(200);
    }
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("Sin WiFi. Evento no enviado.");
      return;
    }
  }

  // Cliente seguro para HTTPS (la nube usa https).
  // setInsecure() = no valida el certificado (suficiente para el proyecto).
  // Si pruebas en local con http://, cambia por:  WiFiClient client;  (sin setInsecure)
  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  http.setConnectTimeout(5000);
  http.setTimeout(5000);

  http.begin(client, API_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key", API_KEY);

  // Armamos el JSON a mano (no hace falta libreria extra)
  String payload = String("{\"tipo\":\"") + tipo +
                   "\",\"peso\":" + String(peso, 1) +
                   ",\"distancia\":" + String(distancia, 1) + "}";

  int code = http.POST(payload);

  if (code > 0) {
    Serial.print("Evento '");
    Serial.print(tipo);
    Serial.print("' enviado. HTTP ");
    Serial.println(code);
  } else {
    Serial.print("Error al enviar evento: ");
    Serial.println(HTTPClient::errorToString(code));
  }

  http.end();
}
