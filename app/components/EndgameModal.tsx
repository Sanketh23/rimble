"use client";

type EndgameModalProps = {
  open: boolean;
  onClose: () => void;
  isWin: boolean;
  foundMap: boolean[];
  foundCount: number;
  totalCount: number;
  missesUsed: number;
  maxMisses: number;
  onShare: () => void;
  columns: number;
};

export default function EndgameModal({
  open,
  onClose,
  isWin,
  foundMap,
  foundCount,
  totalCount,
  missesUsed,
  maxMisses,
  onShare,
  columns,
}: EndgameModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 py-8 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0F172A] p-6 shadow-2xl shadow-black/50">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-300">
              Rimble Results
            </p>
            <h2 className="mt-2 text-2xl font-black uppercase tracking-[0.08em] text-white">
              {isWin ? "Congratulations!" : "Better luck next time"}
            </h2>
            <p className="mt-2 text-sm text-white/70">
              You found {foundCount} of {totalCount} answers with {missesUsed}{" "}
              miss{missesUsed === 1 ? "" : "es"} used (max {maxMisses}).
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/70 transition hover:text-white"
          >
            Close
          </button>
        </div>

        <div
          className="mt-6 grid gap-2"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {foundMap.map((found, index) => (
            <div
              key={`result-${index}`}
              className={`h-8 w-full rounded-md border text-center text-xs font-bold uppercase tracking-[0.2em] ${
                found
                  ? "border-emerald-400/40 bg-emerald-500/30 text-emerald-100"
                  : "border-red-500/30 bg-red-500/20 text-red-100"
              }`}
            >
              {found ? "✓" : "×"}
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            onClick={onShare}
            className="w-full rounded-xl bg-gradient-to-r from-blue-500 via-blue-600 to-red-500 px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-white shadow-lg shadow-red-500/20 transition hover:translate-y-[-1px] hover:shadow-red-500/40 sm:w-auto"
          >
            Share Results
          </button>
          <p className="text-xs text-white/50">
            Challenge a friend to beat your score.
          </p>
        </div>
      </div>
    </div>
  );
}
