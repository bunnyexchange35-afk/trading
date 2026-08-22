export default function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-neon-green via-neon-cyan to-neon-purple p-[1.5px] shadow-glow">
        <div className="flex h-full w-full items-center justify-center rounded-[7px] bg-ink-900">
          <span className="font-display text-sm font-bold text-neon-green neon-text">H</span>
        </div>
      </div>
      {!compact && (
        <div className="leading-tight">
          <p className="font-display text-[15px] font-bold tracking-tight text-slate-50">
            HYPE <span className="text-neon-green neon-text">COIN</span>
          </p>
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-slate-500">Control</p>
        </div>
      )}
    </div>
  );
}
