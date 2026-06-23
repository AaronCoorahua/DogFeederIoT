# 🐶 DogFeeder

Dashboard móvil para un dispensador inteligente de comida. Hecho con
**Next.js + shadcn/ui** (tema azul, modo oscuro). Muestra el estado del
dispositivo, métricas y un botón grande para **alimentar**.

## Flujo

```
ESP32  ──heartbeat (perroCerca, peso, distancia) cada 1.5s──►  /api/dispositivo/heartbeat
       ◄──── { alimentar, pesoObjetivo } ───────────────────────┘

Usuario pulsa "Alimentar"  ──►  /api/alimentar  (deja comando pendiente)
ESP32 (en su heartbeat) recibe alimentar=true  ──►  abre, sirve hasta el peso, cierra
ESP32  ──► /api/dispositivo/resultado { gramos }  ──►  "Sirvió X g"  ──(5s)──►  listo

Navegador  ──GET /api/estado (cada 1.5s)──►  pinta el dashboard
```

Sin hardware conectado, al pulsar "Alimentar" la app **simula** la ración a
los ~3 s (modo demo) para poder mostrarla sin el ESP32.

## Pantallas

- **/login** — acceso (demo: cualquier correo/contraseña).
- **/** — dashboard: tarjeta de alimentación, métricas, estado de componentes
  (operativo / revisar / desconectado) y actividad reciente.

## Correr en local

```bash
cd dogfeeder
npm install
npm run dev        # http://localhost:3000
```

Crea `dogfeeder/.env.local` con la clave (igual al `API_KEY` del Arduino):

```
DEVICE_API_KEY=123456789
```

### Probar sin ESP32 (simular el dispositivo)

```powershell
$h = @{ "x-api-key"="123456789"; "Content-Type"="application/json" }
# Reporta estado "perro cerca":
Invoke-RestMethod http://localhost:3000/api/dispositivo/heartbeat -Method Post -Headers $h -Body '{"perroCerca":true,"peso":0,"distancia":12}'
# Reporta una ración servida:
Invoke-RestMethod http://localhost:3000/api/dispositivo/resultado -Method Post -Headers $h -Body '{"gramos":248}'
```

## API

| Método | Ruta | Quién | Para qué |
|---|---|---|---|
| POST | `/api/dispositivo/heartbeat` | ESP32 (x-api-key) | reporta estado y recibe si debe alimentar |
| POST | `/api/dispositivo/resultado` | ESP32 (x-api-key) | informa los gramos servidos |
| POST | `/api/alimentar` | web | el usuario pide alimentar |
| GET  | `/api/estado` | web | estado + métricas para el dashboard |

## Desplegar en Vercel

1. Sube el repo a GitHub e impórtalo en vercel.com.
2. **Settings → Environment Variables**: agrega `DEVICE_API_KEY = 123456789`
   (sin esto, el ESP32 recibe 401).
3. En el Arduino, `API_BASE` ya apunta a tu dominio de Vercel.

> ⚠️ **Almacenamiento.** El estado vive **en memoria** (`lib/store.ts`). En
> Vercel *serverless* la memoria no se comparte entre invocaciones, así que el
> flujo con estado (comando pendiente, historial) puede comportarse de forma
> intermitente. Para que funcione 100% en la nube, migra el store a una base de
> datos compartida (Upstash Redis o Vercel KV/Postgres). La interfaz de
> `lib/store.ts` no cambiaría, solo el "cómo se guarda".

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS v4 + shadcn/ui (tema azul)
- lucide-react (iconos)
- Sesión de demo con cookie (server components, sin middleware)
