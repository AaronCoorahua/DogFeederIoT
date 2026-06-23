import { Cpu, Wifi, Scale, Radar, Cog, type LucideIcon } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import type { Componente } from "@/lib/types";

const ICONOS: Record<string, LucideIcon> = {
  esp32: Cpu,
  wifi: Wifi,
  peso: Scale,
  distancia: Radar,
  servo: Cog,
};

export function ComponentsCard({
  componentes,
}: {
  componentes: Componente[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Componentes</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1 pt-0">
        {componentes.map((c) => {
          const Icon = ICONOS[c.key] ?? Cpu;
          return (
            <div
              key={c.key}
              className="flex items-center justify-between gap-3 rounded-lg px-1 py-2"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Icon className="size-4" aria-hidden />
                </div>
                <span className="truncate text-sm font-medium">{c.nombre}</span>
              </div>
              <StatusBadge estado={c.estado} />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
