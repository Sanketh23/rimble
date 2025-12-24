import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: authHeader ? { Authorization: authHeader } : {},
      },
    }
  );
  const { user_id, selected_answer, guess, question_date } =
    await req.json();
  const requestedDate =
    typeof question_date === "string" ? question_date : "";
  const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate);
  const today = isValidDate
    ? requestedDate
    : new Date().toISOString().split("T")[0];
  const MAX_MISSES = 5;
  const submitted = (guess ?? selected_answer ?? "").toString().trim();

  if (!user_id) {
    return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
  }

  if (!submitted) {
    return NextResponse.json({ error: "Missing guess" }, { status: 400 });
  }

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: user_id,
    },
    { onConflict: "id" }
  );

  if (profileError) {
    return NextResponse.json(
      {
        error: "Could not create profile",
        supabase_error: profileError.message,
        supabase_code: profileError.code ?? null,
        supabase_details: profileError.details ?? null,
      },
      { status: 500 }
    );
  }

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

  const { data: question, error: questionError } = await supabase
    .from("questions")
    .select("options")
    .eq("question_date", today)
    .single();

  if (questionError || !question) {
    return NextResponse.json({ error: "No question today" }, { status: 404 });
  }

  const answers = Array.isArray(question.options) ? question.options : [];
  const acceptableAnswers = answers.map((answer) =>
    buildAcceptableAnswers(answer.toString())
  );

  const { data: attempts } = await supabase
    .from("attempts")
    .select("selected_answer, is_correct")
    .eq("user_id", user_id)
    .eq("question_date", today);

  const missesUsed =
    attempts?.filter((attempt) => !attempt.is_correct).length ?? 0;

  if (missesUsed >= MAX_MISSES) {
    return NextResponse.json(
      {
        error: "No attempts left",
        is_complete: true,
        attempts_remaining: 0,
        guesses: attempts?.map((attempt) => attempt.selected_answer) ?? [],
        correct_answers: answers,
      },
      { status: 400 }
    );
  }

  const normalizedGuess = normalize(submitted);
  const matchedAnswerIndex = acceptableAnswers.findIndex((options) =>
    options.includes(normalizedGuess)
  );
  const alreadyGuessedExact =
    attempts?.some(
      (attempt) =>
        normalize(attempt.selected_answer?.toString() ?? "") === normalizedGuess
    ) ?? false;
  const alreadyGuessedAnswer =
    matchedAnswerIndex >= 0
      ? (attempts ?? []).some((attempt) =>
          acceptableAnswers[matchedAnswerIndex].includes(
            normalize(attempt.selected_answer?.toString() ?? "")
          )
        )
      : false;
  const alreadyGuessed = alreadyGuessedExact || alreadyGuessedAnswer;

  if (alreadyGuessed) {
    return NextResponse.json(
      {
        error: "Already guessed",
        attempts_remaining: Math.max(MAX_MISSES - missesUsed, 0),
        guesses: attempts?.map((attempt) => attempt.selected_answer) ?? [],
        is_complete: false,
      },
      { status: 400 }
    );
  }

  const is_correct = matchedAnswerIndex >= 0;
  const score = is_correct ? 100 : 0;

  // Insert attempt
  const { error: insertError } = await supabase.from("attempts").insert({
    user_id,
    question_date: today,
    selected_answer: submitted,
    is_correct,
    score,
  });

  if (insertError) {
    return NextResponse.json(
      {
        error: "Could not save attempt",
        supabase_error: insertError.message,
        supabase_code: insertError.code ?? null,
        supabase_details: insertError.details ?? null,
      },
      { status: 500 }
    );
  }

  const missesAfter = missesUsed + (is_correct ? 0 : 1);
  const attemptsRemaining = Math.max(MAX_MISSES - missesAfter, 0);
  const attemptsCombined = [
    ...(attempts ?? []),
    { selected_answer: submitted, is_correct },
  ];
  const foundMap = acceptableAnswers.map((options) =>
    attemptsCombined.some(
      (attempt) =>
        attempt.is_correct &&
        options.includes(normalize(attempt.selected_answer?.toString() ?? ""))
    )
  );
  const allFound = acceptableAnswers.length > 0 && foundMap.every(Boolean);
  const isComplete = allFound || missesAfter >= MAX_MISSES;
  const didWin = allFound;

  let streak: number | null = null;

  if (isComplete) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("current_streak, max_streak, total_score")
      .eq("id", user_id)
      .single();

    if (profile) {
      const newStreak = didWin ? profile.current_streak + 1 : 0;

      await supabase
        .from("profiles")
        .update({
          current_streak: newStreak,
          max_streak: Math.max(profile.max_streak, newStreak),
          total_score: profile.total_score + score,
        })
        .eq("id", user_id);

      streak = newStreak;
    }
  }

  return NextResponse.json({
    is_correct,
    score,
    streak,
    is_complete: isComplete,
    attempts_remaining: attemptsRemaining,
    guesses: [
      ...(attempts?.map((attempt) => attempt.selected_answer) ?? []),
      submitted,
    ],
    correct_answers: isComplete ? answers : undefined,
  });
}
