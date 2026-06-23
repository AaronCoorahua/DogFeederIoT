"use client";

import { memo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
} from "recharts";

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--popover-foreground)",
} as const;

const sameData = (a: { data: unknown }, b: { data: unknown }) =>
  JSON.stringify(a.data) === JSON.stringify(b.data);

export const FoodChart = memo(function FoodChart({
  data,
}: {
  data: { dia: string; gramos: number }[];
}) {
  return (
    <div className="h-32 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
          <XAxis
            dataKey="dia"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            contentStyle={tooltipStyle}
            formatter={(v) => [`${v} g`, "Servido"]}
          />
          <Bar
            dataKey="gramos"
            fill="var(--chart-1)"
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}, sameData);

const fmtFecha = (f: string) => {
  const d = new Date(`${f}T12:00:00Z`);
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
};

export const WeightChart = memo(function WeightChart({
  data,
}: {
  data: { fecha: string; kg: number }[];
}) {
  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
          <XAxis
            dataKey="fecha"
            tickFormatter={fmtFecha}
            tickLine={false}
            axisLine={false}
            minTickGap={28}
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
          />
          <YAxis
            width={36}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            domain={[
              (min: number) => Math.floor(min - 1),
              (max: number) => Math.ceil(max + 1),
            ]}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(l) => fmtFecha(String(l))}
            formatter={(v) => [`${v} kg`, "Peso"]}
          />
          <Line
            type="monotone"
            dataKey="kg"
            stroke="var(--chart-1)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}, sameData);
