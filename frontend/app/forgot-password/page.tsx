// Forgot password page with three-step flow: email -> verify code -> reset password
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { forgotPassword, verifyCode, resetPassword } from "@/lib/api";
import StaggeredFade from "../scrollMotion/StaggeredFade";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [step, setStep] = useState<"email" | "verify" | "reset">("email");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [loading, setLoading] = useState(false);
    const [countdown, setCountdown] = useState(30); // Countdown timer for resend cooldown
    const router = useRouter();

    // Prevent scrolling to match login page behavior
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
        };
    }, []);

    // Countdown timer for resend button (starts when user reaches verify step)
    useEffect(() => {
        if (step === "verify" && countdown > 0) {
            const timer = setInterval(() => {
                setCountdown((prev) => prev - 1);
            }, 1000);

            return () => clearInterval(timer);
        }
    }, [step, countdown]);

    const handleSendCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccess("");
        setLoading(true);

        try {
            await forgotPassword({ email });
            setSuccess("A verification code has been sent to your email");
            setStep("verify");
            setCountdown(20); // Reset countdown when sending code
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : "Failed to send verification code. Please try again.";
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    // Resends verification code (reuses same code via backend deduplication)
    const handleResendCode = async () => {
        setError("");
        setSuccess("");
        setLoading(true);

        try {
            await forgotPassword({ email });
            setSuccess("Verification code resent to your email");
            setCountdown(30); // Reset countdown
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : "Failed to resend code. Please try again.";
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        if (code.length !== 6) {
            setError("Please enter a 6-digit code.");
            return;
        }

        setLoading(true);

        try {
            await verifyCode({ email, code });
            setSuccess("Code verified! Please enter your new password.");
            setStep("reset");
        } catch {
            // User-friendly error message when code verification fails
            setError("The code you entered is incorrect or has expired. Please try again or request a new code.");
            setCode(""); // Clear the input field so button changes back to "Resend Code"
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        if (newPassword !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        if (newPassword.length < 8) {
            setError("Password must be at least 8 characters long.");
            return;
        }

        setLoading(true);

        try {
            await resetPassword({ email, code, newPassword });
            setSuccess("Password has been reset successfully! Redirecting to login...");
            setTimeout(() => {
                router.push("/login");
            }, 2000);
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : "Failed to reset password. Please try again.";
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <StaggeredFade>
            <div className="flex justify-center items-center h-screen overflow-hidden px-4">
                <div className="w-full max-w-md p-8 space-y-4 bg-white/5 border border-[#bfa68a] rounded-2xl shadow-lg backdrop-blur-lg">
                    {step === "email" ? (
                        <>
                            <h1 className="text-4xl font-playfair text-center text-[#F9F6F2]">Reset Password</h1>
                            <p className="text-[#bfa68a] mt-2 text-sm text-center">
                                Enter your email address and we&apos;ll send you a verification code.
                            </p>
                            <form onSubmit={handleSendCode} className="space-y-4">
                                <div>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="Email"
                                        className="w-full h-12 px-4 rounded-lg border-2 border-[#bfa68a] text-[#F9F6F2] bg-black/20 placeholder-[#bfa68a]/70 focus:outline-none focus:border-[#f0e6d2] transition-all"
                                        required
                                        disabled={loading}
                                    />
                                </div>
                                {error && (
                                    <div className="relative overflow-hidden bg-gradient-to-r from-red-500/20 to-rose-500/20 border-2 border-red-500/40 rounded-xl p-4 backdrop-blur-sm">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl"></div>
                                        <div className="relative flex items-start gap-3">
                                            <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <p className="text-sm text-red-300 leading-relaxed">{error}</p>
                                        </div>
                                    </div>
                                )}
                                {success && (
                                    <div className="relative overflow-hidden bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-2 border-green-500/40 rounded-xl p-4 backdrop-blur-sm">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-3xl"></div>
                                        <div className="relative flex items-start gap-3">
                                            <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <p className="text-sm text-green-300 leading-relaxed">{success}</p>
                                        </div>
                                    </div>
                                )}
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-3 font-semibold text-[#1e1512] bg-gradient-to-r from-[#bfa68a] to-[#f0e6d2] rounded-xl hover:opacity-90 hover:scale-[1.02] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                >
                                    {loading ? "Sending..." : "Send Verification Code"}
                                </button>
                            </form>
                        </>
                    ) : step === "verify" ? (
                        <>
                            <h1 className="text-4xl font-playfair text-center text-[#F9F6F2]">Enter Verification Code</h1>
                            <p className="text-[#bfa68a] text-sm text-center leading-relaxed">
                                Enter the 6-digit code sent to your email.
                            </p>
                            <form onSubmit={handleVerifyCode} className="space-y-4">
                                <div className="space-y-4">
                                    <div className="bg-[#bfa68a]/10 border-2 border-[#bfa68a]/30 rounded-xl p-6 backdrop-blur-sm">
                                        <input
                                            type="text"
                                            value={code}
                                            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                            placeholder="000000"
                                            className="w-full h-16 px-4 rounded-lg border-2 border-[#bfa68a] text-[#F9F6F2] bg-black/20 placeholder-[#bfa68a]/40 focus:outline-none focus:border-[#f0e6d2] text-center text-4xl tracking-[0.5em] font-bold transition-all"
                                            required
                                            disabled={loading}
                                            maxLength={6}
                                            pattern="[0-9]{6}"
                                            autoFocus
                                        />
                                    </div>
                                    {code.length === 0 ? (
                                        <button
                                            type="button"
                                            onClick={handleResendCode}
                                            disabled={loading || countdown > 0}
                                            className="w-full py-3 font-semibold text-[#1e1512] bg-gradient-to-r from-[#bfa68a] to-[#f0e6d2] rounded-xl hover:opacity-90 hover:scale-[1.02] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                        >
                                            {loading ? "Resending..." : countdown > 0 ? `Resend Code (${countdown}s)` : "Resend Code"}
                                        </button>
                                    ) : (
                                        <button
                                            type="submit"
                                            disabled={loading || code.length !== 6}
                                            className="w-full py-3 font-semibold text-[#1e1512] bg-gradient-to-r from-[#bfa68a] to-[#f0e6d2] rounded-xl hover:opacity-90 hover:scale-[1.02] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                        >
                                            {loading ? "Verifying..." : "Verify Code"}
                                        </button>
                                    )}
                                </div>
                                {error && (
                                    <div className="relative overflow-hidden bg-gradient-to-r from-red-500/20 to-rose-500/20 border-2 border-red-500/40 rounded-xl p-4 backdrop-blur-sm">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl"></div>
                                        <div className="relative flex items-start gap-3">
                                            <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <p className="text-sm text-red-300 leading-relaxed">{error}</p>
                                        </div>
                                    </div>
                                )}
                                {success && (
                                    <div className="relative overflow-hidden bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-2 border-green-500/40 rounded-xl p-4 backdrop-blur-sm">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-3xl"></div>
                                        <div className="relative flex items-start gap-3">
                                            <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <p className="text-sm text-green-300 leading-relaxed">{success}</p>
                                        </div>
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setStep("email");
                                        setCode("");
                                        setError("");
                                        setSuccess("");
                                    }}
                                    className="w-full py-2 text-sm text-[#bfa68a] hover:text-[#F9F6F2] transition-colors cursor-pointer"
                                >
                                    Use Different Email
                                </button>
                            </form>
                        </>
                    ) : (
                        <>
                            <h1 className="text-4xl font-playfair text-center text-[#F9F6F2]">Set New Password</h1>
                            <p className="text-[#bfa68a] mt-2 text-sm text-center">
                                Enter your new password below.
                            </p>
                            <form onSubmit={handleResetPassword} className="space-y-4">
                                <div className="space-y-4">
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="New Password"
                                        className="w-full h-12 px-4 rounded-lg border-2 border-[#bfa68a] text-[#F9F6F2] bg-black/20 placeholder-[#bfa68a]/70 focus:outline-none focus:border-[#f0e6d2] transition-all"
                                        required
                                        disabled={loading}
                                        minLength={8}
                                    />
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Confirm New Password"
                                        className="w-full h-12 px-4 rounded-lg border-2 border-[#bfa68a] text-[#F9F6F2] bg-black/20 placeholder-[#bfa68a]/70 focus:outline-none focus:border-[#f0e6d2] transition-all"
                                        required
                                        disabled={loading}
                                        minLength={8}
                                    />
                                </div>
                                {error && (
                                    <div className="relative overflow-hidden bg-gradient-to-r from-red-500/20 to-rose-500/20 border-2 border-red-500/40 rounded-xl p-4 backdrop-blur-sm">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl"></div>
                                        <div className="relative flex items-start gap-3">
                                            <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <p className="text-sm text-red-300 leading-relaxed">{error}</p>
                                        </div>
                                    </div>
                                )}
                                {success && (
                                    <div className="relative overflow-hidden bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-2 border-green-500/40 rounded-xl p-4 backdrop-blur-sm">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-3xl"></div>
                                        <div className="relative flex items-start gap-3">
                                            <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <p className="text-sm text-green-300 leading-relaxed">{success}</p>
                                        </div>
                                    </div>
                                )}
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-3 font-semibold text-[#1e1512] bg-gradient-to-r from-[#bfa68a] to-[#f0e6d2] rounded-xl hover:opacity-90 hover:scale-[1.02] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                >
                                    {loading ? "Resetting..." : "Reset Password"}
                                </button>
                            </form>
                        </>
                    )}
                    <p className="text-sm text-center text-[#bfa68a]">
                        Remember your password?{" "}
                        <Link href="/login" className="underline hover:text-[#F9F6F2] cursor-pointer">
                            Sign In
                        </Link>
                    </p>
                </div>
            </div>
        </StaggeredFade>
    );
}
