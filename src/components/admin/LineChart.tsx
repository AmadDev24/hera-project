type LineSeries = {
  key: string;
  label: string;
  color: string;
  values: number[];
  valueFormatter?: (value: number) => string;
};

type LineChartProps = {
  labels: string[];
  series: LineSeries[];
  height?: number;
  yLabel?: string;
};

export function AdminLineChart({ labels, series, height = 220, yLabel }: LineChartProps) {
  const width = 760;
  const margin = { top: 20, right: 18, bottom: 36, left: 42 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const maxY = Math.max(
    1,
    ...series.flatMap((s) => s.values.map((v) => Number(v) || 0))
  );

  const x = (idx: number) => {
    if (labels.length <= 1) return margin.left;
    return margin.left + (idx / (labels.length - 1)) * innerW;
  };

  const y = (value: number) => {
    const v = Math.max(0, Number(value) || 0);
    return margin.top + innerH - (v / maxY) * innerH;
  };

  const yTicks = 4;
  const tickValues = Array.from({ length: yTicks + 1 }, (_, i) => (maxY / yTicks) * i);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[220px] min-w-[400px] w-full">
        <rect x="0" y="0" width={width} height={height} className="fill-card" />

        {tickValues.map((t) => {
          const yy = y(t);
          return (
            <g key={`grid-${t}`}>
              <line
                x1={margin.left}
                x2={width - margin.right}
                y1={yy}
                y2={yy}
                className="stroke-border"
                strokeDasharray="3 4"
              />
              <text
                x={margin.left - 8}
                y={yy + 4}
                textAnchor="end"
                className="fill-muted-foreground"
                fontSize="10"
              >
                {Number(t.toFixed(2))}
              </text>
            </g>
          );
        })}

        {labels.map((label, idx) => {
          const xx = x(idx);
          const short = label.length > 6 ? label.slice(-5) : label;
          return (
            <text
              key={`x-${label}-${idx}`}
              x={xx}
              y={height - 12}
              textAnchor="middle"
              className="fill-muted-foreground"
              fontSize="10"
            >
              {short}
            </text>
          );
        })}

        {series.map((s) => {
          const points = s.values
            .map((v, idx) => `${x(idx)},${y(v)}`)
            .join(' ');

          return (
            <g key={s.key}>
              <polyline
                fill="none"
                stroke={s.color}
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={points}
              />
              {s.values.map((v, idx) => {
                const formatted = s.valueFormatter ? s.valueFormatter(v) : String(v);
                return (
                  <circle key={`${s.key}-${idx}`} cx={x(idx)} cy={y(v)} r="3" fill={s.color}>
                    <title>{`${labels[idx]} | ${s.label}: ${formatted}`}</title>
                  </circle>
                );
              })}
            </g>
          );
        })}

        <line
          x1={margin.left}
          x2={margin.left}
          y1={margin.top}
          y2={height - margin.bottom}
          className="stroke-border"
        />
        <line
          x1={margin.left}
          x2={width - margin.right}
          y1={height - margin.bottom}
          y2={height - margin.bottom}
          className="stroke-border"
        />

        {yLabel && (
          <text
            x="12"
            y={margin.top - 4}
            className="fill-muted-foreground"
            fontSize="10"
          >
            {yLabel}
          </text>
        )}
      </svg>

      <div className="mt-3 flex flex-wrap gap-3 text-xs">
        {series.map((s) => (
          <div key={`legend-${s.key}`} className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            <span>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}