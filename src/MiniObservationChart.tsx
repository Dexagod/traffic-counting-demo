import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { SparqlBinding, SanitizedObservation } from "./util/query";
import { sanitizeObservations } from "./util/query";

function MiniObservationChart({ observations }: { observations: SparqlBinding[] }) {
  // 1) sanitize -> { startMs, end, durationSec, count, vehicleType }
  const sanitized = useMemo<SanitizedObservation[]>(
    () => sanitizeObservations(observations),
    [observations]
  );

  // 2) aggregate by timeframe using a plain object index to avoid Map collisions
  type Frame = { startMs: number; endMs: number; count: number };
  const frames = useMemo<Frame[]>(() => {
    const frameIndex: Record<string, Frame> = {};
    for (const o of sanitized) {
      const key = `${o.startMs}|${o.durationSec}`;
      const endMs = o.end.getTime();
      if (frameIndex[key]) {
        frameIndex[key].count += o.count;
      } else {
        frameIndex[key] = { startMs: o.startMs, endMs, count: o.count };
      }
    }
    return Object.values(frameIndex).sort((a, b) => a.startMs - b.startMs);
  }, [sanitized]);

  // 3) build a series with gaps (insert null before discontinuities)
  const data = useMemo(() => {
    const out: Array<{ time: number; value: number | null }> = [];
    let lastEnd: number | null = null;
    for (const f of frames) {
      // consider continuous only if next start == last end (within ~1.5s)
      if (lastEnd !== null && Math.abs(f.startMs - lastEnd) > 1500) {
        out.push({ time: f.startMs - 1, value: null }); // forces a visual gap
      }
      out.push({ time: f.startMs, value: f.count });
      lastEnd = f.endMs;
    }
    return out;
  }, [frames]);

  if (data.length === 0) {
    return <div style={{ fontStyle: "italic", color: "#6b7280" }}>No chartable data</div>;
  }

  const minX = data[0]!.time;
  const maxX = data[data.length - 1]!.time;
  const fmtTick = (t: number) =>
    new Date(t).toLocaleString(undefined, {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div style={{ width: 680, height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="time"
            type="number"
            scale="time"
            domain={[minX, maxX]}
            tickFormatter={(v) => fmtTick(Number(v))}
          />
          <YAxis allowDecimals={false} />
          <Tooltip
            labelFormatter={(v) => fmtTick(Number(v))}
            formatter={(val) => (val == null ? "" : `${val}`)}
          />
          <Area type="monotone" dataKey="value" connectNulls={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default MiniObservationChart;
