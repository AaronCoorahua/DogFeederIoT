import { Scale, Bone, UtensilsCrossed, Container, type LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
  const { metrics } = estado;
  const maxBarra = Math.max(...metrics.ultimos7.map((d) => d.gramos), 1);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Metric
          Icon={Scale}
          label="Peso actual"
          value={Math.round(metrics.pesoActual)}
          sufijo="g"
        />
        <Metric
          Icon={Bone}
          label="Servido hoy"
          value={metrics.gramosHoy}
          sufijo="g"
        />
        <Metric
          Icon={UtensilsCrossed}
          label="Raciones hoy"
          value={metrics.vecesHoy}
        />
        <Metric
          Icon={Container}
          label="Nivel de tolva"
          value={metrics.nivelTolva}
          sufijo="%"
        >
          <Progress value={metrics.nivelTolva} className="mt-1" />
        </Metric>
      </div>

      {/* Mini-grafico de los ultimos 7 dias (barras con puro CSS) */}
      <Card>
        <CardContent className="p-4">
          <p className="mb-3 text-xs font-medium text-muted-foreground">
            Últimos 7 días
          </p>
          <div className="flex h-24 items-end justify-between gap-2">
            {metrics.ultimos7.map((d, i) => {
              const altura = (d.gramos / maxBarra) * 100;
              const esHoy = i === metrics.ultimos7.length - 1;
              return (
                <div
                  key={d.dia}
                  className="flex flex-1 flex-col items-center gap-1.5"
                >
                  <div className="flex h-full w-full items-end">
                    <div
                      className={
                        "w-full rounded-t-md transition-all " +
                        (esHoy ? "bg-primary" : "bg-primary/35")
                      }
                      style={{ height: `${Math.max(altura, 4)}%` }}
                      title={`${d.gramos} g`}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {d.dia}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
