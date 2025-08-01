// Login page with support for both password and email-based authentication
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loginUser, emailLogin } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import StaggeredFade from "../scrollMotion/StaggeredFade";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isEmailLogin, setIsEmailLogin] = useState(false);
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

    const handlePasswordLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            await loginUser({ email, password });
            await login(); // Trigger a state refresh in the context
            router.push("/");
        } catch (err) {
            setError("Failed to login. Please check your credentials.");
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setMessage("");
        setIsLoading(true);

        try {
            const result = await emailLogin({ email });
            setMessage(result.Message || "If an account with this email exists, a login link has been sent.");
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to send login link';
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        if (isEmailLogin) {
            handleEmailLogin(e);
        } else {
            handlePasswordLogin(e);
        }
    };

    return (
        <StaggeredFade>
            <div className="flex justify-center items-center h-screen overflow-hidden" style={{ height: '100vh', maxHeight: '100vh' }}>
                <div className="w-full max-w-md p-8 space-y-6 bg-white/5 border border-[#bfa68a] rounded-2xl shadow-lg backdrop-blur-lg transform -translate-y-[25%]">
                    <h1 className="text-4xl font-playfair text-center text-[#F9F6F2]">
                        {isEmailLogin ? "What's your email?" : "Welcome Back"}
                    </h1>
                    <p className="text-[#bfa68a] mt-2 text-sm text-center">
                        {isEmailLogin 
                            ? "Enter your email to receive a sign-in link"
                            : "We are happy to see you again!"
                        }
                    </p>
                    
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter email address"
                                className="w-full h-10 px-4 rounded-md border border-[#bfa68a] text-[#bfa68a] bg-transparent placeholder-[#bfa68a]/70 focus:outline-none"
                                required
                            />
                        </div>
                        
                        {!isEmailLogin && (
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
                        )}
                        
                        {error && <p className="text-sm text-red-500">{error}</p>}
                        {message && <p className="text-sm text-green-500">{message}</p>}
                        
                        <button 
                            type="submit" 
                            disabled={isLoading}
                            className="w-full py-2 font-semibold text-[#1e1512] bg-gradient-to-r from-[#bfa68a] to-[#f0e6d2] rounded-xl hover:opacity-90 cursor-pointer disabled:opacity-50"
                        >
                            {isLoading ? 'Processing...' : (isEmailLogin ? 'Continue' : 'Sign In')}
                        </button>
                    </form>

                    {!isEmailLogin && (
                        <>
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-[#bfa68a]/30"></div>
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="px-2 bg-transparent text-[#bfa68a]">or</span>
                                </div>
                            </div>

                            <button 
                                onClick={() => setIsEmailLogin(true)}
                                className="w-full py-2 font-semibold text-[#bfa68a] border border-[#bfa68a] rounded-xl hover:bg-[#bfa68a] hover:text-[#1e1512] transition-colors"
                            >
                                Continue with Email
                            </button>
                        </>
                    )}

                    {isEmailLogin && (
                        <button 
                            onClick={() => setIsEmailLogin(false)}
                            className="w-full py-2 font-semibold text-[#bfa68a] border border-[#bfa68a] rounded-xl hover:bg-[#bfa68a] hover:text-[#1e1512] transition-colors"
                        >
                            Sign in with Password
                        </button>
                    )}

                    <div className="text-center space-y-2">
                        {!isEmailLogin && (
                            <p className="text-sm text-[#bfa68a]">
                                <Link href="/forgot-password" className="underline hover:text-[#F9F6F2]">
                                    Forgot your password?
                                </Link>
                            </p>
                        )}
                        <p className="text-sm text-[#bfa68a]">
                            Don&apos;t have an account?{" "}
                            <Link href="/register" className="underline hover:text-[#F9F6F2] cursor-pointer">
                                Sign Up
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </StaggeredFade>
    );
} 