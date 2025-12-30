"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase";
import AppShell from "./components/AppShell";
import CardGrid from "./components/CardGrid";
import EndgameModal from "./components/EndgameModal";
import GuessInput from "./components/GuessInput";
import QuestionHeader from "./components/QuestionHeader";

const MAX_ATTEMPTS_FALLBACK = 5;

type ResultState = {
  is_correct: boolean;
  is_complete: boolean;
  correct_answers?: string[];
  streak?: number | null;
};

export default function Home() {
  const supabase = getSupabaseClient();
  const [user, setUser] = useState<any>(null);
  const [question, setQuestion] = useState<any | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [guess, setGuess] = useState("");
  const [guesses, setGuesses] = useState<string[]>([]);
  const [correctGuesses, setCorrectGuesses] = useState<string[]>([]);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(
    null
  );
  const [result, setResult] = useState<ResultState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastOutcome, setLastOutcome] = useState<
    "correct" | "incorrect" | "duplicate" | null
  >(null);
  const [showEndgame, setShowEndgame] = useState(false);

  const getLocalDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const normalize = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s']/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const suffixes = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);
  const buildAcceptableAnswers = (answer: string) => {
    const normalized = normalize(answer);
    const parts = normalized.split(" ").filter(Boolean);
    if (!parts.length) return [];
    const last = parts[parts.length - 1];
    const lastName =
      suffixes.has(last) && parts.length > 1
        ? parts[parts.length - 2]
        : last;
    return Array.from(new Set([normalized, lastName].filter(Boolean)));
  };

  const optionEntries: unknown[] = Array.isArray(question?.options)
    ? (question.options as unknown[])
    : [];
  const answers: string[] = optionEntries.map((entry) => {
    if (Array.isArray(entry)) {
      return entry.map((value) => value?.toString() ?? "").join(" / ");
    }
    return entry?.toString() ?? "";
  });
  const acceptableAnswers = optionEntries.map((entry) => {
    const values = Array.isArray(entry) ? entry : [entry];
    const flattened = values.flatMap((value) =>
      buildAcceptableAnswers(value?.toString() ?? "")
    );
    return Array.from(new Set(flattened.filter(Boolean)));
  });
  const answerLogos = Array.isArray(question?.option_logos)
    ? question.option_logos
    : [];
  const normalizedCorrectGuesses = correctGuesses.map((item) =>
    normalize(item.toString())
  );
  const normalizedRevealGuesses = Array.from(
    new Set([
      ...normalizedCorrectGuesses,
      ...guesses.map((item) => normalize(item.toString())),
    ])
  );
  const retiredPlayers = new Set(
    Array.isArray(question?.retired_players)
      ? question.retired_players.map((name: unknown) =>
          normalize(name?.toString() ?? "")
        )
      : []
  );
  const foundMap = answers.map((_, index) => {
    const options = acceptableAnswers[index] ?? [];
    return normalizedRevealGuesses.some((guess) => options.includes(guess));
  });
  const revealAll = Boolean(result?.is_complete);
  const revealedAnswers = revealAll
    ? answers.map(() => true)
    : foundMap;
  const retiredFlags = optionEntries.map((entry) => {
    const values = Array.isArray(entry) ? entry : [entry];
    return values.some((value) =>
      retiredPlayers.has(normalize(value?.toString() ?? ""))
    );
  });
  const foundCount = foundMap.filter(Boolean).length;
  const maxMisses =
    typeof question?.max_misses === "number"
      ? question.max_misses
      : typeof question?.max_attempts === "number"
      ? question.max_attempts
      : MAX_ATTEMPTS_FALLBACK;
  const resolveLogoSrc = (logo: string | undefined) => {
    if (!logo) return null;
    const trimmed = logo.toString().trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("http") || trimmed.startsWith("/")) {
      return trimmed;
    }
    return `/images/${trimmed}`;
  };
  const resolveLogoList = (logoEntry: unknown) => {
    if (Array.isArray(logoEntry)) {
      return logoEntry
        .map((item) => resolveLogoSrc(item?.toString()))
        .filter((item): item is string => Boolean(item));
    }
    const single = resolveLogoSrc(logoEntry?.toString());
    return single ? [single] : [];
  };
  const missesUsed = Math.max(
    maxMisses - (attemptsRemaining ?? MAX_ATTEMPTS_FALLBACK),
    0
  );
  const isWin = foundCount === answers.length && answers.length > 0;
  const shareColumns = Math.min(
    6,
    Math.max(4, Math.round(Math.sqrt(Math.max(answers.length, 1))))
  );
  const buildShareText = () => {
    const today = getLocalDateString();
    const cells = foundMap.map((found) => (found ? "🟩" : "🟥"));
    const rows: string[] = [];
    for (let i = 0; i < cells.length; i += shareColumns) {
      rows.push(cells.slice(i, i + shareColumns).join(""));
    }
    const grid = rows.join("\n");
    const link =
      typeof window !== "undefined" ? window.location.origin : "";
    return `Rimble ${today}\n${foundCount}/${answers.length} found\n${grid}\nTry to beat my score: ${link}`;
  };
  const handleShare = async () => {
    const text = buildShareText();
    if (navigator.share) {
      await navigator.share({ text });
      return;
    }
    await navigator.clipboard.writeText(text);
  };

  // 🔹 Auth check
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoadingUser(false);
    });
  }, [supabase]);

  // 🔹 Fetch today's question (only after login)
  useEffect(() => {
    if (!user || !supabase) return;

    const loadToday = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const localDate = getLocalDateString();
      await fetch(`/api/today?user_id=${user.id}&date=${localDate}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then((res) => res.json())
        .then((data) => {
        setQuestion(data);
        setGuesses(data.guesses ?? []);
        setCorrectGuesses(data.correct_guesses ?? []);
        setAttemptsRemaining(
          typeof data.attempts_remaining === "number"
            ? data.attempts_remaining
            : MAX_ATTEMPTS_FALLBACK
        );
        if (data.is_complete) {
          setResult({
            is_correct: Boolean(data.is_solved),
            is_complete: true,
            correct_answers: data.correct_answers ?? data.options ?? [],
          });
        }
      });
    };

    loadToday();
  }, [user, supabase]);

  useEffect(() => {
    if (result?.is_complete) {
      setShowEndgame(true);
    }
  }, [result?.is_complete]);

  const submitAnswer = async () => {
    const trimmed = guess.trim();
    if (!trimmed || !user || submitting || !supabase) return;

    setSubmitting(true);
    setError(null);
    setLastOutcome(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const localDate = getLocalDateString();

    const res = await fetch("/api/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        user_id: user.id,
        question_date: localDate,
        guess: trimmed,
      }),
    });

    const payload = await res.json();

    if (!res.ok) {
      setError(payload.error ?? "Something went wrong.");
      if (payload.error === "Already guessed") {
        setLastOutcome("duplicate");
      }
      if (typeof payload.attempts_remaining === "number") {
        setAttemptsRemaining(payload.attempts_remaining);
      }
      if (payload.guesses) {
        setGuesses(payload.guesses);
      }
      if (payload.correct_guesses) {
        setCorrectGuesses(payload.correct_guesses);
      }
      if (payload.is_complete) {
        setResult({
          is_correct: Boolean(payload.is_correct),
          is_complete: true,
          correct_answers: payload.correct_answers ?? question?.options ?? [],
          streak: payload.streak ?? null,
        });
      }
      setSubmitting(false);
      return;
    }

    setGuess("");
    setGuesses(payload.guesses ?? []);
    if (payload.correct_guesses) {
      setCorrectGuesses(payload.correct_guesses);
    } else if (payload.is_correct) {
      setCorrectGuesses((prev) => [...prev, trimmed]);
    }
    setAttemptsRemaining(payload.attempts_remaining ?? attemptsRemaining);
    setResult({
      is_correct: payload.is_correct,
      is_complete: payload.is_complete,
      correct_answers: payload.correct_answers,
      streak: payload.streak ?? null,
    });
    setLastOutcome(payload.is_correct ? "correct" : "incorrect");
    setSubmitting(false);
  };

  if (loadingUser) {
    return (
      <div className="min-h-screen bg-[#0B1220] text-white flex items-center justify-center">
        Loading…
      </div>
    );
  }

  if (!supabase) {
    return (
      <div className="min-h-screen bg-[#0B1220] text-white flex items-center justify-center">
        Missing Supabase configuration.
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0B1220] text-white flex items-center justify-center px-6">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center shadow-xl shadow-black/40">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-300">
            Rimble
          </p>
          <h1 className="mt-3 text-3xl font-black uppercase tracking-[0.08em]">
            Log in to play
          </h1>
          <p className="mt-2 text-sm text-white/70">
            Create an account or sign in to save streaks and play today&apos;s
            puzzle.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 via-blue-600 to-red-500 px-6 py-4 text-lg font-black uppercase tracking-[0.2em] text-white shadow-lg shadow-red-500/30 transition hover:translate-y-[-1px] hover:shadow-red-500/50"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="min-h-screen bg-[#0B1220] text-white flex items-center justify-center">
        Loading today’s question…
      </div>
    );
  }

  return (
    <AppShell streak={result?.streak ?? null}>
      <div className="space-y-8">
        <QuestionHeader
          title={question.question}
          subtitle={`Find any of the top ${answers.length} answers.`}
          missesLeft={attemptsRemaining ?? MAX_ATTEMPTS_FALLBACK}
          maxMisses={maxMisses}
        />
        {typeof question?.rules_note === "string" ? (
          <p className="text-center text-sm font-black uppercase tracking-[0.2em] text-white">
            {question.rules_note
              .split("\n")
              .filter((line: string) => line.trim().length > 0)
              .map((line: string, index: number) => (
                <span
                  key={`rule-${index}`}
                  className={`block ${index > 0 ? "mt-2" : ""}`}
                >
                  {line}
                </span>
              ))}
          </p>
        ) : (
          <p className="text-center text-sm font-black uppercase tracking-[0.2em] text-white">
            <span className="block">Active players show current team logo.</span>
            <span className="block mt-2">
              * Retired players show longest-tenured team.
            </span>
          </p>
        )}

        <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <GuessInput
              guess={guess}
              onGuessChange={setGuess}
              onSubmit={submitAnswer}
              disabled={Boolean(result?.is_complete)}
              submitting={submitting}
              error={error}
              outcome={lastOutcome}
            />

            {result && (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-center text-lg font-semibold text-white/90">
                {result.is_correct
                  ? "✅ Correct."
                  : result.is_complete
                  ? "❌ Out of attempts."
                  : "❗ Wrong guess."}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-blue-500/10 via-transparent to-red-500/10 p-6 text-center text-white/80">
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">
              Daily Rules
            </p>
            <p className="mt-3 text-lg font-black uppercase text-white">
              {maxMisses} misses max
            </p>
            <p className="mt-2 text-sm">
              Keep guessing until you run out of misses.
            </p>
          </div>
        </section>

        <CardGrid
          answers={answers}
          revealed={revealedAnswers}
          logos={answers.map((_, index) =>
            resolveLogoList(answerLogos[index])
          )}
          retiredFlags={retiredFlags}
          foundCount={foundCount}
          totalCount={answers.length}
          revealAll={revealAll}
        />
      </div>
      <EndgameModal
        open={showEndgame}
        onClose={() => setShowEndgame(false)}
        isWin={isWin}
        foundMap={foundMap}
        foundCount={foundCount}
        totalCount={answers.length}
        missesUsed={missesUsed}
        maxMisses={maxMisses}
        onShare={handleShare}
        columns={shareColumns}
      />
    </AppShell>
  );
}
