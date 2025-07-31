// This file defines the Login page for the application.
"use client";
import { useState, useEffect } from "react";
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

    // Prevent scrolling for login page
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        
        return () => {
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
        };
    }, []);

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
        <div className="flex justify-center items-center h-screen overflow-hidden" style={{ height: '100vh', maxHeight: '100vh' }}>
            <div className="w-full max-w-md p-8 space-y-6 bg-white/5 border border-[#bfa68a] rounded-2xl shadow-lg backdrop-blur-lg transform -translate-y-[25%]">
                 <h1 className="text-4xl font-playfair text-center text-[#F9F6F2]">Welcome Back</h1>
                 <p className="text-[#bfa68a] mt-2 text-sm text-center">
                   We are happy to see you again!
                 </p>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Email"
                            className="w-full h-10 px-4 rounded-md border border-[#bfa68a] text-[#bfa68a] bg-transparent placeholder-[#bfa68a]/70 focus:outline-none"
                            required
                        />
                    </div>
                    <div>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Password"
                            className="w-full h-10 px-4 rounded-md border border-[#bfa68a] text-[#bfa68a] bg-transparent placeholder-[#bfa68a]/70 focus:outline-none"
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