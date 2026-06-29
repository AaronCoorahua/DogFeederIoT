#include <HX711_ADC.h>
#include <ESP32Servo.h>


// ======================================================
// BUZZER
// ======================================================
const int BUZZER = 21;   // D21 / GPIO 21

// ======================================================
// SERVO
// ======================================================
Servo compuerta;

const int servoPin = 18;

const int ANGULO_CERRADO = 0;
const int ANGULO_ABIERTO = 90;

// ======================================================
// LEDs
// ======================================================
const int LED_AZUL = 2;    // D2 / GPIO 2
const int LED_ROJO = 19;   // D19 / GPIO 19

bool estadoLedAzul = false;
unsigned long ultimoParpadeo = 0;
const unsigned long INTERVALO_PARPADEO = 250; // ms

// ======================================================
// HX711
// ======================================================
const int HX711_dout = 4;
const int HX711_sck  = 5;

HX711_ADC LoadCell(HX711_dout, HX711_sck);

float calibrationValue = -403;

// ======================================================
// HC-SR04
// ======================================================
const int TRIG_PIN = 27;
const int ECHO_PIN = 26;

// ======================================================
// CONFIGURACIÓN
// ======================================================
const float DISTANCIA_ACTIVACION = 20.0;
float PESO_OBJETIVO = 14.0;

bool dispensando = false;
bool compuertaAbierta = false;

// ======================================================
// SETUP
// ======================================================
void setup() {

  Serial.begin(115200);
  delay(1000);

  // LEDs
  pinMode(LED_AZUL, OUTPUT);
  pinMode(LED_ROJO, OUTPUT);

  pinMode(BUZZER, OUTPUT);
  digitalWrite(BUZZER, LOW);

  digitalWrite(LED_AZUL, LOW);
  digitalWrite(LED_ROJO, HIGH); // Rojo siempre prendido al conectar ESP32

  // Servo
  compuerta.attach(servoPin);
  Serial.print("Servo → inicializando en ");
  Serial.print(ANGULO_CERRADO);
  Serial.println("°  (CERRADO)");

  compuerta.write(ANGULO_CERRADO);
  compuertaAbierta = false;

  Serial.println("Servo → listo");

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

  actualizarLedAzul();

  float distancia = medirDistancia();
  float peso = LoadCell.getData();

  Serial.print("Distancia: ");
  Serial.print(distancia);
  Serial.print(" cm   ");

  Serial.print("Peso: ");
  Serial.print(peso * (-1));
  Serial.println(" g");

  // --------------------------------------------------
  // Detectar mascota
  // --------------------------------------------------
  if (!dispensando &&
      distancia > 0 &&
      distancia <= DISTANCIA_ACTIVACION) {

    Serial.println("Mascota detectada");
    Serial.println("Abriendo compuerta");

    LoadCell.tare();

    Serial.print("Servo → moviendo a ");
    Serial.print(ANGULO_ABIERTO);
    Serial.println("°  (ABIERTO)");

    compuerta.write(ANGULO_ABIERTO);
    compuertaAbierta = true;

    Serial.println("Servo → posición ABIERTO alcanzada");

    // Buzzer: 1 segundo al abrir
    digitalWrite(BUZZER, HIGH);
    delay(1000);
    digitalWrite(BUZZER, LOW);

    dispensando = true;

    delay(500);
  }

  // --------------------------------------------------
  // Dispensar comida
  // --------------------------------------------------
  if (dispensando) {

    actualizarLedAzul();

    peso = LoadCell.getData();

    if ((peso * (-1)) >= PESO_OBJETIVO) {

      Serial.println("Peso objetivo alcanzado");

      Serial.print("Servo → moviendo a ");
      Serial.print(ANGULO_CERRADO);
      Serial.println("°  (CERRADO)");

      compuerta.write(ANGULO_CERRADO);
      compuertaAbierta = false;

      digitalWrite(LED_AZUL, LOW);
      estadoLedAzul = false;

      Serial.println("Servo → posición CERRADO alcanzada");
      Serial.println("Compuerta cerrada");

      dispensando = false;

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
// PARPADEO LED AZUL
// ======================================================
void actualizarLedAzul() {

  if (compuertaAbierta) {

    unsigned long tiempoActual = millis();

    if (tiempoActual - ultimoParpadeo >= INTERVALO_PARPADEO) {
      ultimoParpadeo = tiempoActual;

      estadoLedAzul = !estadoLedAzul;
      digitalWrite(LED_AZUL, estadoLedAzul);
    }

  } else {
    digitalWrite(LED_AZUL, LOW);
    estadoLedAzul = false;
  }
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