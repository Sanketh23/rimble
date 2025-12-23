"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import AppShell from "./components/AppShell";

const MAX_ATTEMPTS_FALLBACK = 3;

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

    fetch(`/api/today?user_id=${user.id}`)
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
  }, [user]);

  const submitAnswer = async () => {
    const trimmed = guess.trim();
    if (!trimmed || !user || submitting) return;

    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: user.id,
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
            Find any of the top {question?.options?.length ?? 0} answers.
          </p>
        </div>

        {/* Question */}
        <div className="text-lg text-center leading-relaxed">
          {question.question}
        </div>

        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            Attempts left:{" "}
            {attemptsRemaining ?? MAX_ATTEMPTS_FALLBACK}
          </span>
          <span>Guesses: {guesses.length}</span>
        </div>

        {/* Guess Input */}
        <div className="space-y-3">
          <input
            type="text"
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            disabled={result?.is_complete}
            placeholder="Type your guess"
            className="w-full py-3 rounded-md border px-4 focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-100"
          />
          <button
            onClick={submitAnswer}
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
        </div>

        {/* Results */}
        {result && (
          <div className="text-center space-y-2">
            <p className="text-xl">
              {result.is_correct
                ? "✅ Correct! You got one of the top answers."
                : result.is_complete
                ? "❌ Out of attempts."
                : "Keep trying!"}
            </p>
            {result.is_complete && (
              <p className="text-gray-600">
                Answers:{" "}
                <b>{(result.correct_answers ?? []).join(", ")}</b>
              </p>
            )}
            {typeof result.streak === "number" && (
              <p className="text-sm">🔥 Streak: {result.streak}</p>
            )}
          </div>
        )}

        {/* Guesses */}
        {guesses.length > 0 && (
          <div className="text-sm text-gray-500">
            Your guesses: {guesses.join(", ")}
          </div>
        )}
      </div>
    </AppShell>
  );
}
