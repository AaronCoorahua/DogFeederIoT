// ======================================================
// Estado del dispensador EN MEMORIA + maquina de estados.
//
// Flujo:
//   1. El ESP32 manda "heartbeat" cada ~1.5s con: perroCerca, peso, distancia.
//      La respuesta le dice si hay un comando "alimentar" pendiente.
//   2. El usuario pulsa "Alimentar" en la app -> POST /api/alimentar -> deja
//      un comando pendiente y la fase pasa a "alimentando".
//   3. El ESP32 abre, dispensa hasta el peso objetivo, cierra y reporta los
//      gramos -> POST /api/dispositivo/resultado -> fase "completado".
//   4. A los 5s la fase vuelve sola a "listo" (se calcula al leer el estado).
//
// Sin hardware conectado, si pulsas "Alimentar" se simula la alimentacion a
// los ~3s (modo demo) para poder probar la app sin el ESP32.
//
// Es en memoria: perfecto para local / host de proceso unico. Para Vercel
// serverless conviene migrar a una BD (la interfaz de funciones no cambiaria).
// ======================================================

import type {
  Evento,
  EstadoPublico,
  SaludEstado,
  Fase,
} from "@/lib/types";

export const PESO_OBJETIVO = 250; // gramos por racion
const VENTANA_ONLINE_MS = 12_000; // si no reporta en 12s -> offline
const RESET_COMPLETADO_MS = 5_000; // "completado" -> "listo" tras 5s
const TIMEOUT_ALIMENTANDO_MS = 30_000; // failsafe si nunca llega resultado
const SIMULA_DEMO_MS = 3_000; // sin hardware, completa solo tras 3s

interface Store {
  dispositivo: {
    perroCerca: boolean;
    peso: number;
    distancia: number;
    ultimoReporte: number | null; // epoch ms
  };
  feed: {
    fase: Fase;
    comandoPendiente: boolean;
    comandoEn: number | null;
    ultimaCantidad: number;
    completadoEn: number | null;
  };
  eventos: Evento[];
  nextId: number;
}

const g = globalThis as unknown as { __dogfeeder?: Store };

function getStore(): Store {
  if (!g.__dogfeeder) {
    g.__dogfeeder = {
      dispositivo: {
        perroCerca: false,
        peso: 0,
        distancia: 0,
        ultimoReporte: null,
      },
      feed: {
        fase: "listo",
        comandoPendiente: false,
        comandoEn: null,
        ultimaCantidad: 0,
        completadoEn: null,
      },
      eventos: [],
      nextId: 1,
    };
  }
  return g.__dogfeeder;
}

function estaOnline(store: Store, ahora: number): boolean {
  const t = store.dispositivo.ultimoReporte;
  return t !== null && ahora - t < VENTANA_ONLINE_MS;
}

function registrarAlimentacion(
  store: Store,
  gramos: number,
  origen: "dispositivo" | "demo",
  ahora: number
) {
  store.feed.fase = "completado";
  store.feed.ultimaCantidad = gramos;
  store.feed.completadoEn = ahora;
  store.feed.comandoPendiente = false;
  store.eventos.unshift({
    id: store.nextId++,
    gramos,
    origen,
    timestamp: new Date(ahora).toISOString(),
  });
  if (store.eventos.length > 50) store.eventos.length = 50;
}

// Aplica las transiciones automaticas (reset 5s, timeout, demo).
function avanzarTiempo(store: Store, ahora: number) {
  const online = estaOnline(store, ahora);
  const f = store.feed;

  if (f.fase === "completado" && f.completadoEn) {
    if (ahora - f.completadoEn >= RESET_COMPLETADO_MS) {
      f.fase = "listo";
      f.comandoEn = null;
    }
  } else if (f.fase === "alimentando" && f.comandoEn) {
    if (!online && ahora - f.comandoEn >= SIMULA_DEMO_MS) {
      // Modo demo: no hay hardware, simulamos la racion.
      const gramos = PESO_OBJETIVO + Math.round((Math.random() - 0.5) * 12);
      registrarAlimentacion(store, gramos, "demo", ahora);
    } else if (ahora - f.comandoEn >= TIMEOUT_ALIMENTANDO_MS) {
      // El dispositivo nunca respondio: volvemos a listo.
      f.fase = "listo";
      f.comandoPendiente = false;
      f.comandoEn = null;
    }
  }
}

// ---- API del ESP32 ----------------------------------------------------------

// El ESP32 reporta y recibe si debe alimentar.
export function heartbeat(data: {
  perroCerca: boolean;
  peso: number;
  distancia: number;
}): { alimentar: boolean; pesoObjetivo: number } {
  const store = getStore();
  const ahora = Date.now();

  store.dispositivo.perroCerca = !!data.perroCerca;
  store.dispositivo.peso = Number(data.peso) || 0;
  store.dispositivo.distancia = Number(data.distancia) || 0;
  store.dispositivo.ultimoReporte = ahora;

  avanzarTiempo(store, ahora);

  // Despacha el comando una sola vez.
  let alimentar = false;
  if (store.feed.comandoPendiente && store.feed.fase === "alimentando") {
    alimentar = true;
    store.feed.comandoPendiente = false;
  }

  return { alimentar, pesoObjetivo: PESO_OBJETIVO };
}

// El ESP32 termino de dispensar y reporta los gramos.
export function reportarResultado(gramos: number) {
  const store = getStore();
  registrarAlimentacion(store, Number(gramos) || 0, "dispositivo", Date.now());
}

// ---- API de la app ----------------------------------------------------------

// El usuario pidio alimentar desde la web.
export function pedirAlimentar(): { ok: boolean; motivo?: string } {
  const store = getStore();
  const ahora = Date.now();
  avanzarTiempo(store, ahora);

  if (store.feed.fase !== "listo") {
    return { ok: false, motivo: "Ya hay una alimentacion en curso." };
  }
  store.feed.fase = "alimentando";
  store.feed.comandoPendiente = true;
  store.feed.comandoEn = ahora;
  return { ok: true };
}

export function obtenerEstado(): EstadoPublico {
  const store = getStore();
  const ahora = Date.now();
  avanzarTiempo(store, ahora);

  const online = estaOnline(store, ahora);
  const d = store.dispositivo;

  // --- Metricas (mezcla de real + mock) ---
  const hoy = new Date(ahora);
  const esHoy = (iso: string) => {
    const f = new Date(iso);
    return (
      f.getFullYear() === hoy.getFullYear() &&
      f.getMonth() === hoy.getMonth() &&
      f.getDate() === hoy.getDate()
    );
  };
  const eventosHoy = store.eventos.filter((e) => esHoy(e.timestamp));
  const gramosHoy = eventosHoy.reduce((s, e) => s + e.gramos, 0);

  // Mini-historial 7 dias (mock estable + suma real de hoy)
  const baseSemana = [180, 240, 0, 250, 200, 260, 0];
  const dias = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const ultimos7 = dias.map((dia, i) => ({
    dia,
    gramos: i === 6 ? gramosHoy : baseSemana[i],
  }));

  const componentes: { key: string; nombre: string; estado: SaludEstado }[] = [
    { key: "esp32", nombre: "Controlador ESP32", estado: online ? "ok" : "offline" },
    { key: "wifi", nombre: "Conexión WiFi", estado: online ? "ok" : "offline" },
    {
      key: "peso",
      nombre: "Sensor de peso HX711",
      estado: online ? "ok" : "offline",
    },
    {
      key: "distancia",
      nombre: "Sensor ultrasónico HC-SR04",
      estado: online ? (d.distancia >= 999 ? "warn" : "ok") : "offline",
    },
    { key: "servo", nombre: "Servomotor compuerta", estado: online ? "ok" : "offline" },
  ];

  return {
    online,
    perroCerca: online && d.perroCerca,
    peso: d.peso,
    distancia: d.distancia,
    fase: store.feed.fase,
    ultimaCantidad: store.feed.ultimaCantidad,
    pesoObjetivo: PESO_OBJETIVO,
    metrics: {
      pesoActual: d.peso,
      gramosHoy,
      vecesHoy: eventosHoy.length,
      nivelTolva: 78, // mock
      ultimos7,
    },
    componentes,
    eventos: store.eventos.slice(0, 6),
  };
}
