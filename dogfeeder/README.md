# 🐶 DogFeeder

App Next.js que recibe los eventos del dispensador (ESP32) y muestra en tiempo
real cuándo se **abre** y se **cierra** la compuerta, con el peso de comida.

## Cómo funciona

```
ESP32  ──POST /api/eventos──►  Next.js (API)  ──guarda──►  store en memoria
                                                                │
Navegador  ──GET /api/eventos (cada 2 s)──────────────────────►┘
```

- `app/api/eventos/route.ts` → recibe (POST) del ESP32 y entrega (GET) a la web.
- `lib/store.ts` → guarda los eventos.
- `app/page.tsx` → interfaz que hace polling cada 2 segundos.

## Correr en local

```bash
cd dogfeeder
npm install
npm run dev
```

Abre http://localhost:3000

### Probar la API sin el ESP32 (simular un evento)

```bash
curl -X POST http://localhost:3000/api/eventos ^
  -H "Content-Type: application/json" ^
  -H "x-api-key: cambia-esta-clave" ^
  -d "{\"tipo\":\"abierto\",\"peso\":0,\"distancia\":15}"
```

(En PowerShell usa `Invoke-RestMethod`; en Git Bash usa `\` en vez de `^`.)

## Variables de entorno

Copia `.env.example` a `.env.local` y define la clave:

```
DEVICE_API_KEY=una-clave-secreta
```

Esa clave **debe ser igual** al `API_KEY` del código Arduino.

## Subir a la nube (Vercel)

1. Sube esta carpeta a GitHub.
2. En vercel.com → New Project → importa el repo.
3. En **Settings → Environment Variables** agrega `DEVICE_API_KEY`.
4. Deploy. Tu URL será algo como `https://dogfeeder.vercel.app`.
5. En el Arduino pon: `API_URL = "https://dogfeeder.vercel.app/api/eventos"`.

> ⚠️ **Importante sobre el almacenamiento.** El store es *en memoria*. En Vercel
> (serverless) la memoria se reinicia entre peticiones, así que el historial
> puede "perderse". Para local o para un host de proceso único (Render, Railway)
> funciona bien. Para producción seria, cambia `lib/store.ts` por una base de
> datos (Vercel Postgres, Upstash Redis, Supabase...). La interfaz de funciones
> queda igual, solo cambia el "cómo se guarda".
