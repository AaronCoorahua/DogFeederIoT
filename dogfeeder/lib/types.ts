// Tipos compartidos entre el servidor y los componentes de cliente.

export type Fase = "listo" | "alimentando" | "completado";
export type SaludEstado = "ok" | "warn" | "offline";
export type ServingSource = "scheduled" | "manual" | "demo";
export type ServingStatus = "commanded" | "served" | "missed" | "failed";

export interface Evento {
  id: string;
  gramos: number; // grams_actual ?? grams_target
  origen: ServingSource;
  status: ServingStatus;
  label: string | null;
  timestamp: string; // served_at ?? commanded_at (ISO)
}

export interface Componente {
  key: string;
  nombre: string;
  estado: SaludEstado;
}

export interface ComidaHoy {
  label: string | null;
  hora: string; // "08:00"
  gramos: number;
  estado: "servido" | "pendiente" | "saltado";
}

export interface EstadoPublico {
  online: boolean;
  perroCerca: boolean;
  peso: number; // lectura viva de la balanza (g)
  distancia: number;
  fase: Fase;
  servoAbierto: boolean; // compuerta en modo manual (forzar servir)
  ultimaCantidad: number;
  pesoObjetivo: number;

  dog: {
    name: string;
    photoUrl: string | null;
    pesoKg: number | null;
    edad: number | null;
  };

  nextFeed: { label: string | null; hora: string; gramos: number } | null;
  adherencia: { servidoHoy: number; objetivoHoy: number; pct: number };

  metrics: {
    gramosHoy: number;
    vecesHoy: number;
    nivelTolva: number; // %
    ultimos7: { dia: string; gramos: number }[];
  };

  pesoSerie: { fecha: string; kg: number }[]; // tendencia de peso corporal
  comidasHoy: ComidaHoy[];
  componentes: Componente[];
  eventos: Evento[];
}

// ---- Modelo de dominio (Supabase) ------------------------------------------

export interface Dog {
  id: string;
  name: string;
  photo_path: string | null;
  birthdate: string | null; // ISO date
  age_years: number | null;
  weight_g: number | null;
  breed: string | null;
  timezone: string;
  is_active: boolean;
}

export interface FeedingSchedule {
  id: string;
  dog_id: string;
  feed_time: string; // "HH:MM" / "HH:MM:SS" (hora local)
  grams_target: number;
  label: string | null;
  days_of_week: number[]; // 0=Dom .. 6=Sab
  catch_up_window_minutes: number;
  is_active: boolean;
}

export interface WeightLog {
  id: string;
  dog_id: string;
  weight_g: number;
  measured_on: string; // ISO date
  note: string | null;
}

export interface Serving {
  id: string;
  dog_id: string;
  schedule_id: string | null;
  source: ServingSource;
  status: ServingStatus;
  grams_target: number;
  grams_actual: number | null;
  local_date: string; // ISO date
  commanded_at: string;
  served_at: string | null;
}
