import {
  Bone,
  UtensilsCrossed,
  Container,
  Target,
  type LucideIcon,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { FoodChart, WeightChart } from "@/components/charts";
import type { EstadoPublico } from "@/lib/types";

function Metric({
  Icon,
  label,
  value,
  sufijo,
  children,
}: {
  Icon: LucideIcon;
  label: string;
  value: string | number;
  sufijo?: string;
  children?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Icon className="size-5" aria-hidden />
        </div>
        <div>
          <p className="text-2xl font-bold leading-tight tabular-nums">
            {value}
            {sufijo && (
              <span className="ml-1 text-sm font-medium text-muted-foreground">
                {sufijo}
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

export function MetricsGrid({ estado }: { estado: EstadoPublico }) {
  const { metrics, adherencia, pesoSerie } = estado;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Metric Icon={Bone} label="Servido hoy" value={metrics.gramosHoy} sufijo="g" />
        <Metric Icon={UtensilsCrossed} label="Raciones hoy" value={metrics.vecesHoy} />
        <Metric Icon={Target} label="Adherencia" value={adherencia.pct} sufijo="%">
          <Progress value={Math.min(100, adherencia.pct)} className="mt-1" />
        </Metric>
        <Metric Icon={Container} label="Tolva" value={metrics.nivelTolva} sufijo="%">
          <Progress value={metrics.nivelTolva} className="mt-1" />
        </Metric>
      </div>

      <Card>
        <CardContent className="p-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Comida · últimos 7 días
          </p>
          <FoodChart data={metrics.ultimos7} />
        </CardContent>
      </Card>

      {pesoSerie.length > 1 && (
        <Card>
          <CardContent className="p-4">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Peso (kg)
            </p>
            <WeightChart data={pesoSerie} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
