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
  const url = new URL(req.url);
  const requestedDate = url.searchParams.get("date") ?? "";
  const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate);
  const today = isValidDate
    ? requestedDate
    : new Date().toISOString().split("T")[0];
  const userId = url.searchParams.get("user_id");

  const { data, error } = await supabase
    .from("questions")
    .select(
      "question, options, option_logos, option_meta, question_date, max_misses, rules_note, retired_players"
    )
    .eq("question_date", today)
    .single();

  if (error) {
    return NextResponse.json({ error: "No question today" }, { status: 404 });
  }

  const maxMisses =
    typeof data.max_misses === "number" ? data.max_misses : 5;

  if (!userId) {
    return NextResponse.json({
      ...data,
      max_attempts: maxMisses,
    });
  }

  const { data: attempts } = await supabase
    .from("attempts")
    .select("selected_answer, is_correct")
    .eq("user_id", userId)
    .eq("question_date", today);

  const missesUsed =
    attempts?.filter((attempt) => !attempt.is_correct).length ?? 0;
  const answers = Array.isArray(data.options) ? data.options : [];
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
  const acceptableAnswers = answers.map((entry) => {
    const values = Array.isArray(entry) ? entry : [entry];
    const flattened = values.flatMap((value) =>
      buildAcceptableAnswers(value?.toString() ?? "")
    );
    return Array.from(new Set(flattened.filter(Boolean)));
  });
  const foundMap = acceptableAnswers.map((options) =>
    (attempts ?? []).some(
      (attempt) =>
        attempt.is_correct &&
        options.includes(normalize(attempt.selected_answer?.toString() ?? ""))
    )
  );
  const allFound = acceptableAnswers.length > 0 && foundMap.every(Boolean);
  const isComplete = allFound || missesUsed >= maxMisses;
  const correctGuesses =
    attempts
      ?.filter((attempt) => attempt.is_correct)
      .map((attempt) => attempt.selected_answer) ?? [];

  return NextResponse.json({
    ...data,
    max_attempts: maxMisses,
    attempts_remaining: Math.max(maxMisses - missesUsed, 0),
    guesses: attempts?.map((attempt) => attempt.selected_answer) ?? [],
    correct_guesses: correctGuesses,
    is_complete: isComplete,
    is_solved: allFound,
    correct_answers: isComplete ? answers : undefined,
  });
}
