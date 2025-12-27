"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import AppShell from "./components/AppShell";
import CardGrid from "./components/CardGrid";
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
  const retiredPlayers = new Set([
    "kyle korver",
    "wesley matthews",
    "jj redick",
    "kemba walker",
  ]);
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

  const answers = Array.isArray(question?.options) ? question.options : [];
  const acceptableAnswers = answers.map((answer) =>
    buildAcceptableAnswers(answer.toString())
  );
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
  const revealAll = Boolean(result?.is_complete);
  const revealedAnswers = answers.map((_, index) => {
    const options = acceptableAnswers[index] ?? [];
    return (
      revealAll ||
      normalizedRevealGuesses.some((guess) => options.includes(guess))
    );
  });
  const retiredFlags = answers.map((answer) =>
    retiredPlayers.has(normalize(answer.toString()))
  );
  const foundCount = revealedAnswers.filter(Boolean).length;
  const maxMisses =
    typeof question?.max_attempts === "number"
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

  // 🔹 Auth check
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoadingUser(false);
    });
  }, []);

  // 🔹 Fetch today's question (only after login)
  useEffect(() => {
    if (!user) return;

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
  }, [user]);

  const submitAnswer = async () => {
    const trimmed = guess.trim();
    if (!trimmed || !user || submitting) return;

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

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0B1220] text-white flex items-center justify-center">
        Please log in
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
        <p className="text-center text-sm font-black uppercase tracking-[0.2em] text-white">
          <span className="block">Active players show current team logo.</span>
          <span className="block mt-2">
            * Retired players show longest-tenured team.
          </span>
        </p>

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
              5 misses max
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
    </AppShell>
  );
}
