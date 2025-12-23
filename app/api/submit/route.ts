import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  const { user_id, selected_answer, guess } = await req.json();
  const today = new Date().toISOString().split("T")[0];
  const MAX_ATTEMPTS = 3;
  const submitted = (guess ?? selected_answer ?? "").toString().trim();

  if (!user_id) {
    return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
  }

  if (!submitted) {
    return NextResponse.json({ error: "Missing guess" }, { status: 400 });
  }

  const normalize = (value: string) =>
    value.toLowerCase().replace(/\s+/g, " ").trim();

  const { data: question, error: questionError } = await supabase
    .from("questions")
    .select("options")
    .eq("question_date", today)
    .single();

  if (questionError || !question) {
    return NextResponse.json({ error: "No question today" }, { status: 404 });
  }

  const answers = Array.isArray(question.options) ? question.options : [];
  const normalizedAnswers = answers.map((answer) =>
    normalize(answer.toString())
  );

  const { data: attempts } = await supabase
    .from("attempts")
    .select("selected_answer, is_correct")
    .eq("user_id", user_id)
    .eq("question_date", today);

  const attemptsUsed = attempts?.length ?? 0;
  const alreadySolved = attempts?.some((attempt) => attempt.is_correct) ?? false;

  if (alreadySolved) {
    return NextResponse.json(
      {
        error: "Already solved",
        is_complete: true,
        attempts_remaining: Math.max(MAX_ATTEMPTS - attemptsUsed, 0),
        guesses: attempts?.map((attempt) => attempt.selected_answer) ?? [],
        correct_answers: answers,
      },
      { status: 400 }
    );
  }

  if (attemptsUsed >= MAX_ATTEMPTS) {
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
  const alreadyGuessed =
    attempts?.some(
      (attempt) =>
        normalize(attempt.selected_answer?.toString() ?? "") === normalizedGuess
    ) ?? false;

  if (alreadyGuessed) {
    return NextResponse.json(
      {
        error: "Already guessed",
        attempts_remaining: Math.max(MAX_ATTEMPTS - attemptsUsed, 0),
        guesses: attempts?.map((attempt) => attempt.selected_answer) ?? [],
        is_complete: false,
      },
      { status: 400 }
    );
  }

  const is_correct = normalizedAnswers.includes(normalizedGuess);
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

  const attemptsAfter = attemptsUsed + 1;
  const attemptsRemaining = Math.max(MAX_ATTEMPTS - attemptsAfter, 0);
  const isComplete = is_correct || attemptsAfter >= MAX_ATTEMPTS;

  let streak: number | null = null;

  if (isComplete) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("current_streak, max_streak, total_score")
      .eq("id", user_id)
      .single();

    if (profile) {
      const newStreak = is_correct ? profile.current_streak + 1 : 0;

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
