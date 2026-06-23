"use client";

import { useCallback, useEffect, useState } from "react";
import { Dog, LogOut, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FeedCard } from "@/components/feed-card";
import { MetricsGrid } from "@/components/metrics-grid";
import { ComponentsCard } from "@/components/components-card";
import { ActivityCard } from "@/components/activity-card";
import type { EstadoPublico } from "@/lib/types";

export function Dashboard() {
  const [estado, setEstado] = useState<EstadoPublico | null>(null);
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch("/api/estado", { cache: "no-store" });
      setEstado(await res.json());
    } catch {
      /* reintenta en el siguiente tick */
    }
  }, []);

  useEffect(() => {
    cargar();
    const id = setInterval(cargar, 1500);
    return () => clearInterval(id);
  }, [cargar]);

  async function alimentar() {
    setEnviando(true);
    try {
      await fetch("/api/alimentar", { method: "POST" });
      await cargar();
    } finally {
      setEnviando(false);
    }
  }

  function salir() {
    document.cookie = "df_auth=; path=/; max-age=0; samesite=lax";
    window.location.href = "/login";
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Dog className="size-5" />
          </div>
          <span className="text-lg font-bold tracking-tight">DogFeeder</span>
        </div>
        <Button variant="ghost" size="icon" onClick={salir} aria-label="Salir">
          <LogOut />
        </Button>
      </header>

      {!estado ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <main className="flex flex-col gap-4 p-4">
          <FeedCard
            estado={estado}
            enviando={enviando}
            onAlimentar={alimentar}
          />
          <MetricsGrid estado={estado} />
          <ComponentsCard componentes={estado.componentes} />
          <ActivityCard eventos={estado.eventos} />
        </main>
      )}
    </div>
  );
}
