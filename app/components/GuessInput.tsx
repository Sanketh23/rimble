"use client";

type GuessInputProps = {
  guess: string;
  onGuessChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  submitting: boolean;
  error?: string | null;
  outcome?: "correct" | "incorrect" | "duplicate" | null;
};

export default function GuessInput({
  guess,
  onGuessChange,
  onSubmit,
  disabled,
  submitting,
  error,
  outcome,
}: GuessInputProps) {
  const feedbackClass =
    outcome === "correct"
      ? "animate-[pulse_0.5s_ease]"
      : outcome === "incorrect"
      ? "animate-[shake_0.35s_ease-in-out]"
      : outcome === "duplicate"
      ? "animate-[wiggle_0.4s_ease-in-out]"
      : "";

  return (
    <form
      className={`space-y-3 ${feedbackClass}`}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <input
        type="text"
        value={guess}
        onChange={(e) => onGuessChange(e.target.value)}
        disabled={disabled}
        autoFocus
        placeholder="Type your guess"
        className="w-full rounded-xl border border-white/10 bg-[#0F172A] px-4 py-4 text-lg font-semibold text-white shadow-lg shadow-black/20 placeholder:text-white/40 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/60 disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={submitting || !guess.trim() || disabled}
        className="w-full rounded-xl bg-gradient-to-r from-blue-500 via-blue-600 to-red-500 px-6 py-4 text-lg font-black uppercase tracking-[0.2em] text-white shadow-lg shadow-red-500/20 transition hover:translate-y-[-1px] hover:shadow-red-500/40 disabled:opacity-50"
      >
        Submit Guess
      </button>
      {error && (
        <p className="text-center text-sm font-semibold text-red-300">
          {error}
        </p>
      )}
    </form>
  );
}
