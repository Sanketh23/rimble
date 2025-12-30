"use client";

import PlayerCard from "./PlayerCard";

type CardGridProps = {
  answers: string[];
  revealed: boolean[];
  logos: string[][];
  metaLabels?: string[];
  retiredFlags?: boolean[];
  foundCount: number;
  totalCount: number;
  revealAll: boolean;
};

export default function CardGrid({
  answers,
  revealed,
  logos,
  metaLabels = [],
  retiredFlags = [],
  foundCount,
  totalCount,
  revealAll,
}: CardGridProps) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-semibold text-white/70">
        <span>
          Found: {foundCount} / {totalCount}
        </span>
        {revealAll && <span className="text-blue-200">All answers revealed</span>}
      </div>
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
        {answers.map((answer, index) => (
          <PlayerCard
            key={`${answer}-${index}`}
            name={answer}
            logos={logos[index] ?? []}
            revealed={revealed[index]}
            metaLabel={metaLabels[index] ?? ""}
            retired={retiredFlags[index] ?? false}
          />
        ))}
      </div>
    </section>
  );
}
