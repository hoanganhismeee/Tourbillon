// This file defines the Login page for the application.
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loginUser } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import StaggeredFade from "../scrollMotion/StaggeredFade";

const GOOGLE_AUTH_URL = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5248/api'}/authentication/google`;

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
        <StaggeredFade>
            <div className="flex justify-center items-center h-screen overflow-hidden" style={{ height: '100vh', maxHeight: '100vh' }}>
                <div className="w-full max-w-md p-8 space-y-6 bg-white/5 border border-[#bfa68a] rounded-2xl shadow-lg backdrop-blur-lg transform -translate-y-[25%]">
                     <h1 className="text-4xl font-playfair text-center text-[#F9F6F2]">Welcome Back</h1>
                     <p className="text-[#bfa68a] mt-2 text-sm text-center">
                       We are happy to see you again!
                     </p>
                    {/* Google sign-in — full navigation, not fetch (SameSite cookie is set on response) */}
                    <a
                        href={GOOGLE_AUTH_URL}
                        className="flex items-center justify-center gap-3 w-full py-2 rounded-xl border border-[#bfa68a] text-[#bfa68a] hover:bg-white/5 transition text-sm font-medium"
                    >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                            <path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.198 2.698 1.24 6.65l4.026 3.115Z"/>
                            <path fill="#34A853" d="M16.04 18.013c-1.09.703-2.474 1.078-4.04 1.078a7.077 7.077 0 0 1-6.723-4.823l-4.04 3.067A11.965 11.965 0 0 0 12 24c2.933 0 5.735-1.043 7.834-3l-3.793-2.987Z"/>
                            <path fill="#4A90D9" d="M19.834 21c2.195-2.048 3.62-5.096 3.62-9 0-.71-.109-1.473-.272-2.182H12v4.637h6.436c-.317 1.559-1.17 2.766-2.395 3.558L19.834 21Z"/>
                            <path fill="#FBBC05" d="M5.277 14.268A7.12 7.12 0 0 1 4.909 12c0-.782.125-1.533.357-2.235L1.24 6.65A11.934 11.934 0 0 0 0 12c0 1.92.445 3.73 1.237 5.335l4.04-3.067Z"/>
                        </svg>
                        Continue with Google
                    </a>

                    {/* Divider */}
                    <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-[#bfa68a]/30" />
                        <span className="text-xs text-[#bfa68a]/60">or</span>
                        <div className="flex-1 h-px bg-[#bfa68a]/30" />
                    </div>

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
                                autoComplete="on"
                                className="w-full h-10 px-4 rounded-md border border-[#bfa68a] text-[#bfa68a] bg-transparent placeholder-[#bfa68a]/70 focus:outline-none"
                                required
                            />
                        </div>
                        {error && <p className="text-sm text-red-500">{error}</p>}
                        <button type="submit" className="w-full py-2 font-semibold text-[#1e1512] bg-gradient-to-r from-[#bfa68a] to-[#f0e6d2] rounded-xl hover:opacity-90 cursor-pointer">
                            Sign In
                        </button>
                    </form>
                    <p className="text-sm text-center text-[#bfa68a]">
                        Don&apos;t have an account?{" "}
                        <Link href="/register" className="underline hover:text-[#F9F6F2] cursor-pointer">
                            Sign Up
                        </Link>
                    </p>
                    <p className="text-sm text-center text-[#bfa68a]">
                        Forgot your password?{" "}
                        <Link href="/forgot-password" className="underline hover:text-[#F9F6F2] cursor-pointer">
                            Reset Password
                        </Link>
                    </p>
                    <p className="text-sm text-center text-[#bfa68a]">
                        <Link href="/login/magic" className="underline hover:text-[#F9F6F2] cursor-pointer">
                            Sign in without a password
                        </Link>
                    </p>
                </div>
            </div>
        </StaggeredFade>
    );
} 