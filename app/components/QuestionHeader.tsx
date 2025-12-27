"use client";

type QuestionHeaderProps = {
  title: string;
  subtitle: string;
  missesLeft: number;
  maxMisses: number;
};

export default function QuestionHeader({
  title,
  subtitle,
  missesLeft,
  maxMisses,
}: QuestionHeaderProps) {
  const missesUsed = Math.max(maxMisses - missesLeft, 0);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-black/30">
      <div className="space-y-2 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-300">
        
        </p>
        <h1 className="text-3xl font-black uppercase tracking-[0.08em] text-white sm:text-4xl">
          {title}
        </h1>
        <p className="text-sm text-white/70">{subtitle}</p>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-4">
        <div className="rounded-full border border-blue-400/40 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-100">
          Misses left: {missesLeft}
        </div>
        <div className="flex items-center gap-2">
          {Array.from({ length: maxMisses }).map((_, index) => (
            <span
              key={`miss-${index}`}
              className={`h-3 w-3 rounded-full border ${
                index < missesUsed
                  ? "border-red-500 bg-red-500"
                  : "border-white/40 bg-transparent"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
