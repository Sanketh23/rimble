"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";


export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mode, setMode] = useState<"login" | "signup">("login");
    const router = useRouter();

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            if (data.user) {
                router.push("/");
            }
        });
    }, [router]);

    const signIn = async () => {
        setLoading(true);
        setError(null);

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setError(error.message);
            setLoading(false);
            return;
        }

        router.push("/");
    };

    const signUp = async () => {
        setLoading(true);
        setError(null);

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
        });

        if (data?.user) {
            await supabase.from("profiles").insert({
                id: data.user.id,
                username: email.split("@")[0],
            });
        }

        if (error) {
            setError(error.message);
            setLoading(false);
            return;
        }

        router.push("/");
    };

    return (
        <div className="min-h-screen bg-[#0B1220] text-white flex items-center justify-center px-6">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 shadow-xl shadow-black/40">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-300 text-center">
                    Rimble
                </p>
                <h1 className="mt-3 text-3xl font-black uppercase tracking-[0.08em] text-center">
                    {mode === "login" ? "Log In" : "Sign Up"}
                </h1>
                <p className="mt-2 text-sm text-white/70 text-center">
                    {mode === "login"
                        ? "Sign in to play today’s puzzle."
                        : "Create an account to save streaks."}
                </p>

                {error && (
                    <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
                        {error}
                    </div>
                )}

                <form
                    className="mt-6 space-y-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        if (mode === "login") {
                            signIn();
                        } else {
                            signUp();
                        }
                    }}
                >
                    <input
                        type="email"
                        placeholder="Email"
                        className="w-full rounded-xl border border-white/10 bg-[#0F172A] px-4 py-3 text-base font-semibold text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
                        onChange={(e) => setEmail(e.target.value)}
                    />

                    <input
                        type="password"
                        placeholder="Password"
                        className="w-full rounded-xl border border-white/10 bg-[#0F172A] px-4 py-3 text-base font-semibold text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
                        onChange={(e) => setPassword(e.target.value)}
                    />

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-xl bg-gradient-to-r from-blue-500 via-blue-600 to-red-500 px-6 py-4 text-lg font-black uppercase tracking-[0.2em] text-white shadow-lg shadow-red-500/20 transition hover:translate-y-[-1px] hover:shadow-red-500/40 disabled:opacity-50"
                    >
                        {mode === "login" ? "Log In" : "Sign Up"}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm text-white/60">
                    {mode === "login" ? (
                        <button
                            type="button"
                            onClick={() => setMode("signup")}
                            className="font-semibold text-blue-300 hover:text-blue-200"
                        >
                            Need an account? Sign up
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setMode("login")}
                            className="font-semibold text-blue-300 hover:text-blue-200"
                        >
                            Already have an account? Log in
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
