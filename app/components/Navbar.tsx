"use client";

type NavbarProps = {
  streak?: number | null;
};

export default function Navbar({ streak }: NavbarProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0B1220]/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-gradient-to-br from-blue-500 to-red-500 px-2 py-1 text-sm font-black uppercase tracking-[0.2em] text-white">
            Rimble
          </div>
          <div className="text-lg font-black uppercase tracking-[0.2em] text-white">
            Daily Puzzle
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm font-semibold text-white/80">
          <span className="rounded-full bg-white/10 px-3 py-1">
            🔥 Streak {streak ?? 0}
          </span>
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-gradient-to-br from-blue-500/40 to-red-500/40 text-base shadow-lg shadow-black/30">
            🏀
          </span>
        </div>
      </div>
    </header>
  );
}
