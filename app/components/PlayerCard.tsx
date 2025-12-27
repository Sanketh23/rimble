"use client";

type PlayerCardProps = {
  name: string;
  logos: string[];
  revealed: boolean;
  retired?: boolean;
};

export default function PlayerCard({
  name,
  logos,
  revealed,
  retired = false,
}: PlayerCardProps) {
  return (
    <div className="[perspective:1200px]">
      <div
        className={`relative h-full min-h-44 w-full rounded-2xl border border-white/10 bg-[#0F172A] text-white shadow-lg shadow-black/40 transition-transform duration-500 [transform-style:preserve-3d] ${
          revealed ? "[transform:rotateY(180deg)]" : ""
        }`}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl px-4 py-5 [backface-visibility:hidden]">
          <div className="flex flex-wrap items-center justify-center gap-3">
            {logos.length > 0 ? (
              logos.map((logoSrc) => (
                <img
                  key={logoSrc}
                  src={logoSrc}
                  alt=""
                  className="h-14 w-14 object-contain sm:h-16 sm:w-16"
                />
              ))
            ) : (
              <div className="h-12 w-12 rounded-full border border-dashed border-white/20" />
            )}
          </div>
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-white/70">
            Hidden{retired ? " *" : ""}
          </div>
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-gradient-to-br from-blue-500/20 via-transparent to-red-500/20 px-4 py-5 text-center [transform:rotateY(180deg)] [backface-visibility:hidden]">
          <div className="flex flex-wrap items-center justify-center gap-3">
            {logos.length > 0 ? (
              logos.map((logoSrc) => (
                <img
                  key={logoSrc}
                  src={logoSrc}
                  alt=""
                  className="h-14 w-14 object-contain sm:h-16 sm:w-16"
                />
              ))
            ) : (
              <div className="h-12 w-12 rounded-full border border-dashed border-white/20" />
            )}
          </div>
          <div className="text-sm font-black uppercase tracking-[0.2em] text-white">
            {name}
            {retired ? " *" : ""}
          </div>
        </div>
      </div>
    </div>
  );
}
