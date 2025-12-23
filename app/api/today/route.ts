import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
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
  const today = new Date().toISOString().split("T")[0];
  const MAX_ATTEMPTS = 3;
  const url = new URL(req.url);
  const userId = url.searchParams.get("user_id");

  const { data, error } = await supabase
    .from("questions")
    .select("question, options, question_date")
    .eq("question_date", today)
    .single();

  if (error) {
    return NextResponse.json({ error: "No question today" }, { status: 404 });
  }

  if (!userId) {
    return NextResponse.json({
      ...data,
      max_attempts: MAX_ATTEMPTS,
    });
  }

  const { data: attempts } = await supabase
    .from("attempts")
    .select("selected_answer, is_correct")
    .eq("user_id", userId)
    .eq("question_date", today);

  const attemptsUsed = attempts?.length ?? 0;
  const isSolved = attempts?.some((attempt) => attempt.is_correct) ?? false;
  const isComplete = isSolved || attemptsUsed >= MAX_ATTEMPTS;

  return NextResponse.json({
    ...data,
    max_attempts: MAX_ATTEMPTS,
    attempts_remaining: Math.max(MAX_ATTEMPTS - attemptsUsed, 0),
    guesses: attempts?.map((attempt) => attempt.selected_answer) ?? [],
    is_complete: isComplete,
    is_solved: isSolved,
    correct_answers: isComplete ? data.options ?? [] : undefined,
  });
}
