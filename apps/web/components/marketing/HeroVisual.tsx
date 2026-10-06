"use client";

/** Full-bleed factory / film-plane visual for the hero */
export function HeroVisual() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      {/* Atmospheric base */}
      <div className="absolute inset-0 bg-[#050505]" />
      <div className="absolute inset-0 hero-pan bg-[radial-gradient(ellipse_at_30%_40%,rgba(124,58,237,0.45),transparent_55%),radial-gradient(ellipse_at_75%_60%,rgba(0,217,255,0.22),transparent_50%),linear-gradient(180deg,#080808_0%,#050505_100%)]" />

      {/* Film strip geometry — edge to edge */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.55]"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        <defs>
          <linearGradient id="stormLine" x1="0" y1="0" x2="1440" y2="0">
            <stop offset="0%" stopColor="#7C3AED" stopOpacity="0" />
            <stop offset="35%" stopColor="#7C3AED" />
            <stop offset="70%" stopColor="#00D9FF" />
            <stop offset="100%" stopColor="#FF7A00" stopOpacity="0.2" />
          </linearGradient>
          <linearGradient id="frameFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#151515" />
            <stop offset="100%" stopColor="#0A0A0A" />
          </linearGradient>
        </defs>

        {/* Horizontal factory rail */}
        <path
          d="M0 520 C240 480, 480 560, 720 500 S1200 420, 1440 480"
          stroke="url(#stormLine)"
          strokeWidth="2"
          className="hero-draw"
        />

        {/* Film frames along the rail */}
        {[160, 380, 600, 820, 1040, 1260].map((x, i) => (
          <g key={x} className="hero-frame" style={{ animationDelay: `${i * 0.12}s` }}>
            <rect
              x={x - 70}
              y={380 + (i % 2) * 40}
              width="140"
              height="90"
              rx="6"
              fill="url(#frameFill)"
              stroke={i === 2 ? "#00D9FF" : "rgba(255,255,255,0.12)"}
              strokeWidth={i === 2 ? 1.5 : 1}
            />
            {/* sprocket holes */}
            <circle cx={x - 58} cy={395 + (i % 2) * 40} r="3" fill="rgba(255,255,255,0.15)" />
            <circle cx={x - 58} cy={455 + (i % 2) * 40} r="3" fill="rgba(255,255,255,0.15)" />
            <circle cx={x + 58} cy={395 + (i % 2) * 40} r="3" fill="rgba(255,255,255,0.15)" />
            <circle cx={x + 58} cy={455 + (i % 2) * 40} r="3" fill="rgba(255,255,255,0.15)" />
            {/* mini scene bars */}
            <rect
              x={x - 50}
              y={410 + (i % 2) * 40}
              width="100"
              height="8"
              rx="2"
              fill={i % 3 === 0 ? "#7C3AED" : i % 3 === 1 ? "#00D9FF" : "#FF7A00"}
              opacity="0.55"
            />
            <rect
              x={x - 50}
              y={424 + (i % 2) * 40}
              width="64"
              height="6"
              rx="2"
              fill="rgba(255,255,255,0.12)"
            />
          </g>
        ))}

        {/* Vertical scan / grid accents */}
        {Array.from({ length: 18 }).map((_, i) => (
          <line
            key={i}
            x1={80 * i}
            y1="0"
            x2={80 * i}
            y2="900"
            stroke="rgba(255,255,255,0.03)"
            strokeWidth="1"
          />
        ))}
      </svg>

      {/* Bottom fade into page */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#080808] to-transparent" />
      <div className="absolute inset-0 noise pointer-events-none" />
    </div>
  );
}
