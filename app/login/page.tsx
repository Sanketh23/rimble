"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";


export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
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
        <div className="min-h-screen flex items-center justify-center px-4">
            <div className="w-full max-w-md bg-slate-800 rounded-2xl p-8 shadow-xl">
                <h1 className="text-3xl font-bold text-center mb-2">
                    NBA Daily Trivia 🏀
                </h1>
                <p className="text-slate-400 text-center mb-6">
                    Log in to play today’s question
                </p>

                {error && (
                    <div className="bg-red-500/10 border border-red-500 text-red-400 p-3 rounded mb-4 text-sm">
                        {error}
                    </div>
                )}

                <div className="space-y-4">
                    <input
                        type="email"
                        placeholder="Email"
                        className="w-full p-3 rounded-lg bg-slate-900 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        onChange={(e) => setEmail(e.target.value)}
                    />

                    <input
                        type="password"
                        placeholder="Password"
                        className="w-full p-3 rounded-lg bg-slate-900 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </div>

                <div className="flex gap-3 mt-6">
                    <button
                        onClick={signIn}
                        disabled={loading}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold py-3 rounded-lg transition"
                    >
                        Log In
                    </button>

                    <button
                        onClick={signUp}
                        disabled={loading}
                        className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 rounded-lg transition"
                    >
                        Sign Up
                    </button>
                </div>
            </div>
        </div>
    );
}
