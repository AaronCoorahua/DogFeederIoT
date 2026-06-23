-- ============================================================================
-- DogFeeder — esquema inicial (Supabase / Postgres)
-- Pega TODO esto en: Supabase -> SQL Editor -> New query -> Run.
-- Crea tablas, RLS, trigger de perfil y el bucket de fotos.
-- Zona horaria de referencia: America/Lima (UTC-5, sin horario de verano).
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- profiles: espejo de auth.users con datos de la app
-- ----------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text,
  display_name text,
  timezone     text not null default 'America/Lima',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- dogs
-- ----------------------------------------------------------------------------
create table public.dogs (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  name       text not null,
  photo_path text,                       -- ruta dentro del bucket 'dog-photos', no URL
  birthdate  date,
  age_years  numeric(4, 1),              -- fallback si no se sabe la fecha
  weight_g   integer,                    -- cache del ultimo peso registrado
  breed      text,
  timezone   text not null default 'America/Lima',
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index dogs_owner_idx on public.dogs (owner_id);

-- ----------------------------------------------------------------------------
-- devices: mapea la API key del ESP32 -> perro/dueno
-- ----------------------------------------------------------------------------
create table public.devices (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references public.profiles (id) on delete cascade,
  dog_id            uuid references public.dogs (id) on delete set null,
  name              text not null default 'Dispensador',
  api_key_hash      text not null,        -- SHA-256 de la clave (nunca la clave cruda)
  near_distance_cm  numeric(5, 1) not null default 20.0,
  hopper_capacity_g integer not null default 1500,
  last_refill_at    timestamptz not null default now(),
  timezone          text not null default 'America/Lima',
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index devices_api_key_hash_key on public.devices (api_key_hash);
create index devices_owner_idx on public.devices (owner_id);
create index devices_dog_idx on public.devices (dog_id);

-- ----------------------------------------------------------------------------
-- feeding_schedules: horarios de comida (hora local + gramos)
-- ----------------------------------------------------------------------------
create table public.feeding_schedules (
  id                      uuid primary key default gen_random_uuid(),
  dog_id                  uuid not null references public.dogs (id) on delete cascade,
  owner_id                uuid not null references public.profiles (id) on delete cascade,
  feed_time               time not null,                 -- hora de pared local (ej. 08:00)
  grams_target            integer not null,
  label                   text,                          -- 'Desayuno', 'Cena'...
  days_of_week            smallint[] not null default '{0,1,2,3,4,5,6}', -- 0=Dom..6=Sab
  catch_up_window_minutes integer not null default 120,  -- ventana para esperar al perro
  is_active               boolean not null default true,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index schedules_dog_idx on public.feeding_schedules (dog_id);
create unique index schedules_dog_time_key
  on public.feeding_schedules (dog_id, feed_time)
  where is_active;

-- ----------------------------------------------------------------------------
-- servings: historial + cerrojo de idempotencia + feed en curso
-- ----------------------------------------------------------------------------
create table public.servings (
  id           uuid primary key default gen_random_uuid(),
  dog_id       uuid not null references public.dogs (id) on delete cascade,
  device_id    uuid references public.devices (id) on delete set null,
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  schedule_id  uuid references public.feeding_schedules (id) on delete set null, -- null = manual
  source       text not null default 'scheduled',  -- 'scheduled' | 'manual' | 'demo'
  status       text not null default 'commanded',  -- 'commanded' | 'served' | 'missed' | 'failed'
  grams_target integer not null,
  grams_actual numeric(7, 1),
  local_date   date not null,                       -- (now() AT TIME ZONE tz)::date
  commanded_at timestamptz not null default now(),
  served_at    timestamptz,
  created_at   timestamptz not null default now()
);
create index servings_dog_date_idx on public.servings (dog_id, local_date);
create index servings_device_status_idx on public.servings (device_id, status);
-- CERROJO: un servido por slot por dia local. Los manuales (schedule_id null) no cuentan.
create unique index servings_slot_per_day
  on public.servings (schedule_id, local_date)
  where schedule_id is not null;

-- ----------------------------------------------------------------------------
-- device_state: telemetria viva (reemplaza el store en memoria)
-- ----------------------------------------------------------------------------
create table public.device_state (
  device_id         uuid primary key references public.devices (id) on delete cascade,
  perro_cerca       boolean not null default false,
  peso_g            numeric(7, 1) not null default 0,
  distancia_cm      numeric(6, 1) not null default 0,
  last_seen         timestamptz,
  feed_phase        text not null default 'idle',  -- 'idle' | 'feeding' | 'completed'
  active_serving_id uuid references public.servings (id) on delete set null,
  updated_at        timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- weight_logs: pesos semanales para tendencia
-- ----------------------------------------------------------------------------
create table public.weight_logs (
  id          uuid primary key default gen_random_uuid(),
  dog_id      uuid not null references public.dogs (id) on delete cascade,
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  weight_g    integer not null,
  measured_on date not null default (now() at time zone 'America/Lima')::date,
  note        text,
  created_at  timestamptz not null default now()
);
create index weights_dog_date_idx on public.weight_logs (dog_id, measured_on);
create unique index weights_dog_day_key on public.weight_logs (dog_id, measured_on);

-- ============================================================================
-- Trigger: crear profile al registrarse un usuario
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================================
-- RLS — todas las tablas, scope owner_id = auth.uid()
-- ============================================================================
alter table public.profiles          enable row level security;
alter table public.dogs              enable row level security;
alter table public.devices           enable row level security;
alter table public.feeding_schedules enable row level security;
alter table public.servings          enable row level security;
alter table public.device_state      enable row level security;
alter table public.weight_logs       enable row level security;

-- profiles: solo el propio perfil
drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles
  for all to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- dogs
drop policy if exists dogs_owner on public.dogs;
create policy dogs_owner on public.dogs
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- devices (el cliente NO debe seleccionar api_key_hash; las rutas de usuario
-- deben elegir columnas seguras. Las rutas de dispositivo usan service-role).
drop policy if exists devices_owner on public.devices;
create policy devices_owner on public.devices
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- feeding_schedules
drop policy if exists schedules_owner on public.feeding_schedules;
create policy schedules_owner on public.feeding_schedules
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- servings: el usuario solo lee su historial; las escrituras van por service-role
drop policy if exists servings_select on public.servings;
create policy servings_select on public.servings
  for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists servings_insert on public.servings;
create policy servings_insert on public.servings
  for insert to authenticated
  with check (owner_id = auth.uid());

-- device_state: lectura si el device es del usuario
drop policy if exists device_state_owner on public.device_state;
create policy device_state_owner on public.device_state
  for select to authenticated
  using (
    exists (
      select 1 from public.devices d
      where d.id = device_state.device_id and d.owner_id = auth.uid()
    )
  );

-- weight_logs
drop policy if exists weights_owner on public.weight_logs;
create policy weights_owner on public.weight_logs
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ============================================================================
-- Storage: bucket privado de fotos. Ruta = <owner_id>/<archivo>
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('dog-photos', 'dog-photos', false)
on conflict (id) do nothing;

drop policy if exists dog_photos_select on storage.objects;
create policy dog_photos_select on storage.objects
  for select to authenticated
  using (bucket_id = 'dog-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists dog_photos_insert on storage.objects;
create policy dog_photos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'dog-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists dog_photos_update on storage.objects;
create policy dog_photos_update on storage.objects
  for update to authenticated
  using (bucket_id = 'dog-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists dog_photos_delete on storage.objects;
create policy dog_photos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'dog-photos' and (storage.foldername(name))[1] = auth.uid()::text);
