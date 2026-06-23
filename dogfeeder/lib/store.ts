// Almacen de eventos EN MEMORIA.
//
// Sirve perfecto para desarrollo local y para hosts de un solo proceso
// (Render, Railway, una VPS...). En Vercel "serverless" la memoria se
// reinicia entre invocaciones, asi que para produccion real conviene
// cambiar esto por una base de datos (Vercel Postgres, Upstash Redis, etc.).
// La interfaz publica (agregarEvento / obtenerEventos / estadoActual)
// no cambiaria, solo el "como se guarda".

export type EventoTipo = "abierto" | "cerrado";

export interface Evento {
  id: number;
  tipo: EventoTipo;
  peso: number;       // gramos
  distancia: number;  // cm
  timestamp: string;  // ISO
}

interface Store {
  eventos: Evento[];
  nextId: number;
}

// Usamos globalThis para que el store sobreviva al hot-reload de Next en dev.
const g = globalThis as unknown as { __dogfeeder?: Store };

function getStore(): Store {
  if (!g.__dogfeeder) {
    g.__dogfeeder = { eventos: [], nextId: 1 };
  }
  return g.__dogfeeder;
}

export function agregarEvento(data: {
  tipo: EventoTipo;
  peso: number;
  distancia: number;
}): Evento {
  const store = getStore();
  const evento: Evento = {
    id: store.nextId++,
    tipo: data.tipo,
    peso: data.peso,
    distancia: data.distancia,
    timestamp: new Date().toISOString(),
  };
  store.eventos.unshift(evento); // el mas reciente primero
  if (store.eventos.length > 100) store.eventos.length = 100; // limite de historial
  return evento;
}

export function obtenerEventos(): Evento[] {
  return getStore().eventos;
}

export function estadoActual(): {
  estado: EventoTipo | "desconocido";
  ultimo: Evento | null;
} {
  const eventos = getStore().eventos;
  const ultimo = eventos[0] ?? null;
  return { estado: ultimo ? ultimo.tipo : "desconocido", ultimo };
}
