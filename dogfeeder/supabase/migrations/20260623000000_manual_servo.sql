-- Servo manual (forzar servir / cerrar) + nivel de tolva por gramos cargados.

-- Orden manual del servo: null | 'abrir' | 'cerrar'
alter table public.device_state
  add column if not exists manual_orden text;

-- Gramos que habia en la tolva tras la ultima recarga (para calcular el nivel).
alter table public.devices
  add column if not exists last_refill_g integer not null default 1500;
