"use client";

export default function TeamPage() {
  const seats = [
    { role: "Producer", name: "You", status: "OWNER" },
    { role: "World Artist", name: "Open seat", status: "INVITE" },
    { role: "Editor", name: "Open seat", status: "INVITE" },
  ];

  return (
    <div className="max-w-[720px] space-y-6 forge-in">
      <div>
        <div className="mono text-[11px] text-chrome mb-2">TEAM // FACTORY CREW</div>
        <h1 className="display text-4xl">Your studio crew</h1>
        <p className="mt-3 text-white/60">Roles map to STORM agents — producer, character, voice, composer.</p>
      </div>
      <div className="space-y-3">
        {seats.map((s) => (
          <div
            key={s.role}
            className="rounded-rs border border-white/[0.08] bg-panel px-5 py-4 flex items-center justify-between"
          >
            <div>
              <div className="font-semibold">{s.role}</div>
              <div className="text-sm text-white/50 mt-0.5">{s.name}</div>
            </div>
            <span className="mono text-[9px] px-2 py-1 rounded-full bg-white/5 border border-white/10">
              {s.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
