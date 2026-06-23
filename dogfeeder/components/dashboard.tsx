"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Dog, LogOut, Loader2, Settings, Play, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FeedCard } from "@/components/feed-card";
import { TodayCard } from "@/components/today-card";
import { MetricsGrid } from "@/components/metrics-grid";
import { ComponentsCard } from "@/components/components-card";
import { ActivityCard } from "@/components/activity-card";
import type { EstadoPublico } from "@/lib/types";

export function Dashboard() {
  const [estado, setEstado] = useState<EstadoPublico | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [servoBusy, setServoBusy] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch("/api/estado", { cache: "no-store" });
      if (res.ok) setEstado(await res.json());
    } catch {
      /* reintenta en el siguiente tick */
    }
  }, []);

  useEffect(() => {
    cargar();
    const id = setInterval(cargar, 2000);
    return () => clearInterval(id);
  }, [cargar]);

  async function alimentar() {
    setEnviando(true);
    try {
      await fetch("/api/feed/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      await cargar();
    } finally {
      setEnviando(false);
    }
  }

  async function servoToggle(abrir: boolean) {
    setServoBusy(true);
    try {
      await fetch(abrir ? "/api/feed/abrir" : "/api/feed/cerrar", {
        method: "POST",
      });
      await cargar();
    } finally {
      setServoBusy(false);
    }
  }

  const dog = estado?.dog;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground">
            {dog?.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={dog.photoUrl}
                alt={dog.name}
                className="size-full object-cover"
              />
            ) : (
              <Dog className="size-5" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-bold leading-tight tracking-tight">
              {dog?.name ?? "DogFeeder"}
            </p>
            {estado && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  className={
                    "size-1.5 rounded-full " +
                    (estado.online ? "bg-success" : "bg-muted-foreground/50")
                  }
                />
                {estado.online ? "En línea" : "Sin conexión"}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Link
            href="/ajustes"
            aria-label="Ajustes"
            className="inline-flex size-8 items-center justify-center rounded-lg text-foreground hover:bg-muted"
          >
            <Settings className="size-4" />
          </Link>
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="ghost" size="icon" aria-label="Salir">
              <LogOut />
            </Button>
          </form>
        </div>
      </header>

      {!estado ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <main className="flex flex-col gap-4 p-4">
          <FeedCard estado={estado} enviando={enviando} onAlimentar={alimentar} />
          <TodayCard estado={estado} />
          <MetricsGrid estado={estado} />
          <ComponentsCard componentes={estado.componentes} />
          <ActivityCard eventos={estado.eventos} />

          {/* Forzar servir / cerrar compuerta (sin importar hora ni presencia) */}
          {estado.servoAbierto ? (
            <Button
              size="xl"
              className="w-full bg-destructive text-white hover:bg-destructive/90"
              disabled={servoBusy}
              onClick={() => servoToggle(false)}
            >
              {servoBusy ? (
                <Loader2 className="animate-spin" />
              ) : (
                <>
                  <Square /> Cerrar compuerta
                </>
              )}
            </Button>
          ) : (
            <Button
              size="xl"
              variant="outline"
              className="w-full"
              disabled={servoBusy}
              onClick={() => servoToggle(true)}
            >
              {servoBusy ? (
                <Loader2 className="animate-spin" />
              ) : (
                <>
                  <Play /> Servir (forzar)
                </>
              )}
            </Button>
          )}
        </main>
      )}
    </div>
  );
}
