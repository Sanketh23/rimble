"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import AppShell from "./components/AppShell";

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
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(
    null
  );
  const [result, setResult] = useState<ResultState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  const answers = Array.isArray(question?.options) ? question.options : [];
  const acceptableAnswers = answers.map((answer) =>
    buildAcceptableAnswers(answer.toString())
  );
  const normalizedGuesses = guesses.map((item) =>
    normalize(item.toString())
  );
  const revealAll = Boolean(result?.is_complete);
  const revealedAnswers = answers.map((_, index) => {
    const options = acceptableAnswers[index] ?? [];
    return (
      revealAll || normalizedGuesses.some((guess) => options.includes(guess))
    );
  });
  const foundCount = revealedAnswers.filter(Boolean).length;

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
      if (typeof payload.attempts_remaining === "number") {
        setAttemptsRemaining(payload.attempts_remaining);
      }
      if (payload.guesses) {
        setGuesses(payload.guesses);
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
    setAttemptsRemaining(payload.attempts_remaining ?? attemptsRemaining);
    setResult({
      is_correct: payload.is_correct,
      is_complete: payload.is_complete,
      correct_answers: payload.correct_answers,
      streak: payload.streak ?? null,
    });
    setSubmitting(false);
  };

  if (loadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Please log in
      </div>
    );
  }

  if (!question) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading today’s question…
      </div>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Title */}
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Question of the Day</h1>
          <p className="text-sm text-gray-500 mt-1">
            Find any of the top {answers.length} answers.
          </p>
        </div>

        {/* Question */}
        <div className="text-lg text-center leading-relaxed">
          {question.question}
        </div>

        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            Misses left:{" "}
            {attemptsRemaining ?? MAX_ATTEMPTS_FALLBACK}
          </span>
        </div>

        {/* Guess Input */}
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            submitAnswer();
          }}
        >
          <input
            type="text"
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            disabled={result?.is_complete}
            placeholder="Type your guess"
            className="w-full py-3 rounded-md border px-4 focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-100"
          />
          <button
            type="submit"
            disabled={
              submitting ||
              !guess.trim() ||
              Boolean(result?.is_complete)
            }
            className="w-full py-3 bg-black text-white rounded-md disabled:opacity-50"
          >
            Submit Guess
          </button>
          {error && (
            <p className="text-sm text-red-600 text-center">{error}</p>
          )}
        </form>

        {/* Results */}
        {result && (
          <div className="text-center space-y-2">
            <p className="text-xl">
              {result.is_correct
                ? "✅ Correct."
                : result.is_complete
                ? "❌ Out of attempts."
                : "Wrong guess"}
            </p>
            {typeof result.streak === "number" && (
              <p className="text-sm">🔥 Streak: {result.streak}</p>
            )}
          </div>
        )}

        {/* Answers Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>
              Found: {foundCount} / {answers.length}
            </span>
            {revealAll && <span>All answers revealed</span>}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {answers.map((answer, index) => {
              const isRevealed = revealedAnswers[index];
              return (
                <div
                  key={`${answer}-${index}`}
                  className={`rounded-md border px-3 py-2 text-sm ${
                    isRevealed
                      ? "border-black bg-white text-black"
                      : "border-gray-200 bg-gray-100 text-gray-400"
                  }`}
                >
                  {isRevealed ? answer : "Hidden"}
                </div>
              );
            })}
          </div>
        </div>

        {/* Guesses list removed */}
      </div>
    </AppShell>
  );
}
