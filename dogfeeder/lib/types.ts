// Tipos compartidos entre el servidor y los componentes de cliente.

export type Fase = "listo" | "alimentando" | "completado";
export type SaludEstado = "ok" | "warn" | "offline";

export interface Evento {
  id: number;
  gramos: number;
  origen: "dispositivo" | "demo";
  timestamp: string; // ISO
}

export interface Componente {
  key: string;
  nombre: string;
  estado: SaludEstado;
}

export interface EstadoPublico {
  online: boolean;
  perroCerca: boolean;
  peso: number;
  distancia: number;
  fase: Fase;
  ultimaCantidad: number;
  pesoObjetivo: number;
  metrics: {
    pesoActual: number;
    gramosHoy: number;
    vecesHoy: number;
    nivelTolva: number;
    ultimos7: { dia: string; gramos: number }[];
  };
  componentes: Componente[];
  eventos: Evento[];
}
