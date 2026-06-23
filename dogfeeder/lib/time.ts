// Helpers de hora local (por defecto America/Lima, UTC-5 sin horario de verano).
// Toda la logica de "es hora?" y "servido hoy?" usa la fecha/hora de pared local.

export interface LocalParts {
  dateStr: string; // "YYYY-MM-DD"
  minutes: number; // minutos desde medianoche (0..1439)
  dow: number; // 0=Domingo .. 6=Sabado
}

export function localParts(date: Date, tz = "America/Lima"): LocalParts {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const p = Object.fromEntries(
    dtf.formatToParts(date).map((x) => [x.type, x.value])
  ) as Record<string, string>;

  const dateStr = `${p.year}-${p.month}-${p.day}`;
  let hour = parseInt(p.hour, 10);
  if (hour === 24) hour = 0; // algunos motores devuelven 24 a medianoche
  const minutes = hour * 60 + parseInt(p.minute, 10);
  // El dia de la semana se calcula desde la fecha local (mediodia UTC evita bordes).
  const dow = new Date(`${dateStr}T12:00:00Z`).getUTCDay();

  return { dateStr, minutes, dow };
}

export function localDateStr(date: Date, tz = "America/Lima"): string {
  return localParts(date, tz).dateStr;
}

// "08:00" o "08:00:00" -> minutos desde medianoche.
export function hhmmToMinutes(t: string): number {
  const [h, m] = t.split(":");
  return parseInt(h, 10) * 60 + parseInt(m, 10);
}
