"use client";

import type { OsLayer } from "@/lib/marketing/os-layers";

/** Static SVG factory-map demo for an OS marketing page */
export function OsInfographic({ layer }: { layer: OsLayer }) {
  const rows = layer.steps;
  const rowH = 40;
  const top = 52;
  const height = top + rows.length * (rowH + 10) + 48;
  const width = 560;

  return (
    <div className="relative w-full rounded-rs-xl border border-white/[0.08] bg-[#0A0A0A] overflow-hidden">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        role="img"
        aria-label={`${layer.title} pipeline infographic`}
      >
        <defs>
          <linearGradient id={`osGrad-${layer.slug}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={layer.accent} stopOpacity="0.35" />
            <stop offset="100%" stopColor={layer.accentSoft} stopOpacity="0.15" />
          </linearGradient>
        </defs>
        <rect width={width} height={height} fill="#0A0A0A" />
        <rect width={width} height={height} fill={`url(#osGrad-${layer.slug})`} opacity="0.4" />
        <text
          x="28"
          y="32"
          fill={layer.accent}
          fontSize="11"
          fontFamily="ui-monospace, monospace"
          letterSpacing="2"
        >
          {layer.eyebrow}
        </text>
        {rows.map((step, i) => {
          const y = top + i * (rowH + 10);
          const w = width - 56 - i * 6;
          return (
            <g key={step.n}>
              <rect
                x="28"
                y={y}
                width={w}
                height={rowH}
                rx="8"
                fill="#12121a"
                stroke={`${layer.accent}66`}
              />
              <text
                x="44"
                y={y + 16}
                fill={layer.accent}
                fontSize="10"
                fontFamily="ui-monospace, monospace"
              >
                {step.n} {step.label.toUpperCase()}
              </text>
              <text
                x="44"
                y={y + 30}
                fill="rgba(255,255,255,0.55)"
                fontSize="11"
                fontFamily="ui-monospace, monospace"
              >
                {step.detail}
              </text>
            </g>
          );
        })}
        <text
          x="28"
          y={height - 18}
          fill="rgba(255,255,255,0.35)"
          fontSize="10"
          fontFamily="ui-monospace, monospace"
        >
          {layer.demoNote}
          {layer.rtc ? ` · ${layer.rtc}` : ""}
        </text>
      </svg>
    </div>
  );
}
