import { CheckCircle2, AlertTriangle, Unplug, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { SaludEstado } from "@/lib/types";

const MAPA: Record<
  SaludEstado,
  { label: string; variant: "success" | "warning" | "muted"; Icon: LucideIcon }
> = {
  ok: { label: "Operativo", variant: "success", Icon: CheckCircle2 },
  warn: { label: "Revisar", variant: "warning", Icon: AlertTriangle },
  offline: { label: "Desconectado", variant: "muted", Icon: Unplug },
};

export function StatusBadge({ estado }: { estado: SaludEstado }) {
  const { label, variant, Icon } = MAPA[estado];
  return (
    <Badge variant={variant}>
      <Icon className="size-3.5" aria-hidden />
      {label}
    </Badge>
  );
}
