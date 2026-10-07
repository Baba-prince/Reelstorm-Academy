"use client";

/** Full-bleed factory / film-plane visual for the hero — YT-OS + Clone atmosphere */
export function HeroVisual() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[#050505]" />
      <div className="absolute inset-0 hero-pan bg-[radial-gradient(ellipse_at_28%_38%,rgba(124,58,237,0.5),transparent_55%),radial-gradient(ellipse_at_72%_58%,rgba(0,217,255,0.28),transparent_50%),radial-gradient(ellipse_at_85%_20%,rgba(255,122,0,0.12),transparent_40%),linear-gradient(180deg,#080808_0%,#050505_100%)]" />

      <svg
        className="absolute inset-0 w-full h-full opacity-[0.6]"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        <defs>
          <linearGradient id="stormLine" x1="0" y1="0" x2="1440" y2="0">
            <stop offset="0%" stopColor="#7C3AED" stopOpacity="0" />
            <stop offset="30%" stopColor="#7C3AED" />
            <stop offset="55%" stopColor="#00D9FF" />
            <stop offset="80%" stopColor="#FF7A00" />
            <stop offset="100%" stopColor="#FF7A00" stopOpacity="0.15" />
          </linearGradient>
          <linearGradient id="frameFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#151515" />
            <stop offset="100%" stopColor="#0A0A0A" />
          </linearGradient>
        </defs>

        <path
          d="M0 520 C240 480, 480 560, 720 500 S1200 420, 1440 480"
          stroke="url(#stormLine)"
          strokeWidth="2"
          className="hero-draw"
        />

        {/* Soft capability marks — not hero clutter; atmospheric only */}
        <text x="48" y="120" fill="rgba(0,217,255,0.35)" fontSize="11" fontFamily="monospace" letterSpacing="3">
          YT-OS · STUDIO · YOUR GPU
        </text>
        <text x="48" y="142" fill="rgba(255,122,0,0.4)" fontSize="11" fontFamily="monospace" letterSpacing="3">
          CLONE · PIXABAY · CENTRAL MINUTES
        </text>

        {[
          { x: 160, label: "IDEA" },
          { x: 380, label: "LINK" },
          { x: 600, label: "DNA" },
          { x: 820, label: "LOCAL" },
          { x: 1040, label: "VAULT" },
          { x: 1260, label: "MERGE" },
        ].map(({ x, label }, i) => (
          <g key={x} className="hero-frame" style={{ animationDelay: `${i * 0.12}s` }}>
            <rect
              x={x - 70}
              y={380 + (i % 2) * 40}
              width="140"
              height="90"
              rx="6"
              fill="url(#frameFill)"
              stroke={i === 3 ? "#FF7A00" : i === 1 ? "#00D9FF" : "rgba(255,255,255,0.12)"}
              strokeWidth={i === 3 || i === 1 ? 1.5 : 1}
            />
            <circle cx={x - 58} cy={395 + (i % 2) * 40} r="3" fill="rgba(255,255,255,0.15)" />
            <circle cx={x - 58} cy={455 + (i % 2) * 40} r="3" fill="rgba(255,255,255,0.15)" />
            <circle cx={x + 58} cy={395 + (i % 2) * 40} r="3" fill="rgba(255,255,255,0.15)" />
            <circle cx={x + 58} cy={455 + (i % 2) * 40} r="3" fill="rgba(255,255,255,0.15)" />
            <text
              x={x}
              y={422 + (i % 2) * 40}
              textAnchor="middle"
              fill="rgba(255,255,255,0.55)"
              fontSize="10"
              fontFamily="monospace"
              letterSpacing="1.5"
            >
              {label}
            </text>
            <rect
              x={x - 50}
              y={434 + (i % 2) * 40}
              width="100"
              height="6"
              rx="2"
              fill={i % 3 === 0 ? "#7C3AED" : i % 3 === 1 ? "#00D9FF" : "#FF7A00"}
              opacity="0.5"
            />
          </g>
        ))}

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

      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#080808] to-transparent" />
      <div className="absolute inset-0 noise pointer-events-none" />
    </div>
  );
}
