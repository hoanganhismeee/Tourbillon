// This file defines the Login page for the application.
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loginUser } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const { login } = useAuth();
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        try {
            await loginUser({ email, password });
            await login(); // Trigger a state refresh in the context
            router.push("/");
        } catch (err) {
            setError("Failed to login. Please check your credentials.");
            console.error(err);
        }
    };

    return (
        <div className="flex justify-center items-center h-screen">
            <div className="w-full max-w-md p-8 space-y-6 bg-white/5 border border-[#bfa68a] rounded-2xl shadow-lg backdrop-blur-lg">
                <h1 className="text-3xl font-bold text-center text-[#F9F6F2]">Sign In</h1>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-[#bfa68a]">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-3 py-2 mt-1 text-[#F9F6F2] bg-transparent border border-[#bfa68a] rounded-md focus:outline-none focus:ring-2 focus:ring-[#bfa68a]"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[#bfa68a]">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3 py-2 mt-1 text-[#F9F6F2] bg-transparent border border-[#bfa68a] rounded-md focus:outline-none focus:ring-2 focus:ring-[#bfa68a]"
                            required
                        />
                    </div>
                    {error && <p className="text-sm text-red-500">{error}</p>}
                    <button type="submit" className="w-full py-2 font-semibold text-[#1e1512] bg-gradient-to-r from-[#bfa68a] to-[#f0e6d2] rounded-xl hover:opacity-90">
                        Sign In
                    </button>
                </form>
                <p className="text-sm text-center text-[#bfa68a]">
                    Don&apos;t have an account?{" "}
                    <Link href="/register" className="underline hover:text-[#F9F6F2]">
                        Sign Up
                    </Link>
                </p>
            </div>
        </div>
    );
} 