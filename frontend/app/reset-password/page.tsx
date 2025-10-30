// Reset password page that allows users to set a new password using the reset token from email
"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { resetPassword } from "@/lib/api";
import StaggeredFade from "../scrollMotion/StaggeredFade";
import { Suspense } from "react";

function ResetPasswordForm() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [token, setToken] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const emailParam = searchParams.get("email");
        const tokenParam = searchParams.get("token");
        
        if (emailParam) setEmail(emailParam);
        if (tokenParam) setToken(tokenParam);

        if (!emailParam || !tokenParam) {
            setError("Invalid reset link. Please request a new password reset.");
        }
    }, [searchParams]);

    const handleSubmit = async (e: React.FormEvent) => {
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
            await resetPassword({ email, code: token, newPassword });
            setSuccess("Password has been reset successfully. Redirecting to login...");
            setTimeout(() => {
                router.push("/login");
            }, 2000);
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : "Failed to reset password. The link may have expired.";
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <StaggeredFade>
            <div className="flex justify-center items-center h-screen overflow-hidden" style={{ height: '100vh', maxHeight: '100vh' }}>
                <div className="w-full max-w-md p-8 space-y-6 bg-white/5 border border-[#bfa68a] rounded-2xl shadow-lg backdrop-blur-lg transform -translate-y-[25%]">
                    <h1 className="text-4xl font-playfair text-center text-[#F9F6F2]">Set New Password</h1>
                    <p className="text-[#bfa68a] mt-2 text-sm text-center">
                        Enter your new password below.
                    </p>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="New Password"
                                className="w-full h-10 px-4 rounded-md border border-[#bfa68a] text-[#bfa68a] bg-transparent placeholder-[#bfa68a]/70 focus:outline-none"
                                required
                                disabled={loading || !email || !token}
                                minLength={8}
                            />
                        </div>
                        <div>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Confirm New Password"
                                className="w-full h-10 px-4 rounded-md border border-[#bfa68a] text-[#bfa68a] bg-transparent placeholder-[#bfa68a]/70 focus:outline-none"
                                required
                                disabled={loading || !email || !token}
                                minLength={8}
                            />
                        </div>
                        {error && <p className="text-sm text-red-500">{error}</p>}
                        {success && <p className="text-sm text-green-500">{success}</p>}
                        <button 
                            type="submit" 
                            disabled={loading || !email || !token}
                            className="w-full py-2 font-semibold text-[#1e1512] bg-gradient-to-r from-[#bfa68a] to-[#f0e6d2] rounded-xl hover:opacity-90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? "Resetting..." : "Reset Password"}
                        </button>
                    </form>
                    <p className="text-sm text-center text-[#bfa68a]">
                        <Link href="/login" className="underline hover:text-[#F9F6F2] cursor-pointer">
                            Back to Sign In
                        </Link>
                    </p>
                </div>
            </div>
        </StaggeredFade>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading...</div>}>
            <ResetPasswordForm />
        </Suspense>
    );
}

