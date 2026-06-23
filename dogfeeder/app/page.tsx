"use client";

import { useEffect, useState } from "react";

interface Evento {
  id: number;
  tipo: "abierto" | "cerrado";
  peso: number;
  distancia: number;
  timestamp: string;
}

interface Estado {
  estado: "abierto" | "cerrado" | "desconocido";
  ultimo: Evento | null;
  eventos: Evento[];
}

function formatearHora(iso: string): string {
  return new Date(iso).toLocaleString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const ICONO: Record<string, string> = {
  abierto: "🟢",
  cerrado: "🔒",
  desconocido: "⚪",
};

const ETIQUETA: Record<string, string> = {
  abierto: "Compuerta abierta",
  cerrado: "Compuerta cerrada",
  desconocido: "Sin datos todavía",
};

export default function Home() {
  const [data, setData] = useState<Estado | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let activo = true;

    async function cargar() {
      try {
        const res = await fetch("/api/eventos", { cache: "no-store" });
        const json = (await res.json()) as Estado;
        if (activo) {
          setData(json);
          setError(false);
        }
      } catch {
        if (activo) setError(true);
      }
    }

    cargar();
    const id = setInterval(cargar, 2000); // refresca cada 2 segundos
    return () => {
      activo = false;
      clearInterval(id);
    };
  }, []);

  const estado = data?.estado ?? "desconocido";
  const eventos = data?.eventos ?? [];
  const ultimo = data?.ultimo ?? null;

  return (
    <div className="contenedor">
      <h1>🐶 DogFeeder</h1>
      <p className="subtitulo">Monitoreo en tiempo real del dispensador</p>

      <p className={`conexion ${error ? "error" : "ok"}`}>
        {error ? "● Sin conexión con el servidor" : "● Conectado · actualiza cada 2 s"}
      </p>

      <div className={`tarjeta-estado ${estado}`}>
        <div className="estado-icono">{ICONO[estado]}</div>
        <div className="estado-texto">{ETIQUETA[estado]}</div>
        {ultimo && (
          <div className="estado-detalle">
            Peso: {ultimo.peso.toFixed(1)} g · Última actualización:{" "}
            {formatearHora(ultimo.timestamp)}
          </div>
        )}
      </div>

      <h2>Historial</h2>
      {eventos.length === 0 ? (
        <p className="vacio">Aún no hay eventos registrados.</p>
      ) : (
        <ul className="lista">
          {eventos.map((ev) => (
            <li key={ev.id} className={`evento ${ev.tipo}`}>
              <span className="evento-tipo">
                {ev.tipo === "abierto" ? "🟢 Abrió" : "🔒 Cerró"}
              </span>
              <span className="evento-info">
                {ev.peso.toFixed(1)} g · {ev.distancia.toFixed(1)} cm
              </span>
              <span className="evento-hora">{formatearHora(ev.timestamp)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
