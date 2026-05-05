// Sign-in methods card for the edit-details page.
// Displays Google, Magic Link, and Password rows with status badges and inline flows.
"use client";
import { useState, useRef, useEffect } from "react";
import {
  User,
  verifyCurrentPassword as apiVerifyCurrentPassword,
  resetPasswordAuthenticated,
  requestPasswordSetup,
  confirmPasswordSetup,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 30;

function validateNewPassword(pw: string, confirm: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Z]/.test(pw)) return "Must include an uppercase letter";
  if (!/\d/.test(pw)) return "Must include a number";
  if (pw !== confirm) return "Passwords do not match";
  return null;
}

function StatusBadge({ label }: { label: string }) {
  return (
    <span
      className="text-xs px-2.5 py-0.5 rounded-full font-medium"
      style={{ background: "#1a2e1a", color: "#4d9e4d" }}
    >
      {label}
    </span>
  );
}

function ActionButton({
  type = "button",
  onClick,
  disabled,
  children,
}: {
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="text-xs px-3 py-1 rounded border border-[var(--primary-brown)]/50 text-[var(--primary-brown)] hover:border-[var(--primary-brown)] transition disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

const inputClass =
  "w-full h-10 px-4 rounded-md border border-[var(--primary-brown)] text-[var(--primary-brown)] bg-transparent placeholder-[var(--primary-brown)]/70 focus:outline-none";

// 6-box OTP input — alphanumeric, same interaction pattern as magic-login page
function OtpBoxes({
  chars,
  onChange,
  disabled,
}: {
  chars: string[];
  onChange: (c: string[]) => void;
  disabled?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const update = (i: number, value: string) => {
    const ch = value.replace(/[^a-zA-Z0-9]/g, "").slice(-1).toUpperCase();
    const next = [...chars];
    next[i] = ch;
    onChange(next);
    if (ch && i < CODE_LENGTH - 1) refs.current[i + 1]?.focus();
  };

  const keyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !chars[i] && i > 0) refs.current[i - 1]?.focus();
  };

  const paste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData
      .getData("text")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, CODE_LENGTH);
    const next = Array(CODE_LENGTH).fill("");
    text.split("").forEach((c, i) => {
      next[i] = c;
    });
    onChange(next);
    refs.current[Math.min(text.length, CODE_LENGTH - 1)]?.focus();
  };

  return (
    <div className="flex gap-2" onPaste={paste}>
      {chars.map((ch, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="text"
          maxLength={1}
          value={ch}
          disabled={disabled}
          onChange={(e) => update(i, e.target.value)}
          onKeyDown={(e) => keyDown(i, e)}
          className="w-10 h-11 text-center text-base font-medium text-[var(--light-cream)] bg-transparent border-b-2 focus:outline-none transition-colors duration-200 uppercase disabled:opacity-40"
          style={{
            borderColor: ch ? "rgba(191,166,138,0.65)" : "rgba(191,166,138,0.2)",
          }}
        />
      ))}
    </div>
  );
}

// ---- Setup flow (no existing password): send OTP → enter code → set new password ----
function SetupFlow({ user, onSuccess }: { user: User; onSuccess: () => void }) {
  const [phase, setPhase] = useState<"send" | "otp">("send");
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [chars, setChars] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const code = chars.join("");
  const codeComplete = code.length === CODE_LENGTH;

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendCode = async () => {
    setSending(true);
    setError("");
    try {
      await requestPasswordSetup();
      setPhase("otp");
      setCooldown(RESEND_COOLDOWN);
      setChars(Array(CODE_LENGTH).fill(""));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send code");
    } finally {
      setSending(false);
    }
  };

  const resend = async () => {
    if (cooldown > 0) return;
    setError("");
    try {
      await requestPasswordSetup();
      setCooldown(RESEND_COOLDOWN);
      setChars(Array(CODE_LENGTH).fill(""));
    } catch {
      setError("Failed to resend. Please try again.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validErr = validateNewPassword(newPw, confirmPw);
    if (validErr) {
      setError(validErr);
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await confirmPasswordSetup(code, newPw);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set password");
      setChars(Array(CODE_LENGTH).fill(""));
    } finally {
      setSubmitting(false);
    }
  };

  if (phase === "send") {
    return (
      <div className="space-y-3">
        <p className="text-xs text-[var(--primary-brown)]/60">
          We&apos;ll send a 6-digit code to{" "}
          <span className="text-[var(--primary-brown)]">{user.email}</span>.
        </p>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <ActionButton onClick={sendCode} disabled={sending}>
          {sending ? "Sending..." : "Send code"}
        </ActionButton>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-3">
        <p className="text-xs text-[var(--primary-brown)]/60">
          Code sent to{" "}
          <span className="text-[var(--primary-brown)]">{user.email}</span>.
        </p>
        <OtpBoxes chars={chars} onChange={setChars} disabled={submitting} />
        <button
          type="button"
          onClick={resend}
          disabled={cooldown > 0}
          className="text-xs text-[var(--primary-brown)]/50 hover:text-[var(--primary-brown)] disabled:opacity-35 disabled:cursor-not-allowed transition"
        >
          {cooldown > 0 ? `Resend code (${cooldown}s)` : "Resend code"}
        </button>
      </div>

      {/* New password fades in once all 6 chars are entered */}
      <div
        className="overflow-hidden transition-all duration-200"
        style={{ maxHeight: codeComplete ? 160 : 0, opacity: codeComplete ? 1 : 0 }}
      >
        <div className="space-y-3 pt-1">
          <input
            type="password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            placeholder="New password"
            autoComplete="new-password"
            className={inputClass}
          />
          <input
            type="password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            placeholder="Confirm password"
            autoComplete="new-password"
            className={inputClass}
          />
        </div>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {codeComplete && (
        <ActionButton type="submit" disabled={submitting || !newPw || !confirmPw}>
          {submitting ? "Setting password..." : "Set password"}
        </ActionButton>
      )}
    </form>
  );
}

// ---- Change flow (has existing password): verify current → set new password ----
function ChangeFlow({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState<"verify" | "forgot">("verify");
  const [currentPw, setCurrentPw] = useState("");
  const [verifyStatus, setVerifyStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [verifyError, setVerifyError] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const currentPwRef = useRef<HTMLInputElement>(null);

  // Focus current password input on mount
  useEffect(() => {
    currentPwRef.current?.focus();
  }, []);

  const showNewFields = mode === "forgot" || verifyStatus === "valid";

  const handleBlur = async () => {
    if (!currentPw || verifyStatus === "checking") return;
    setVerifyStatus("checking");
    setVerifyError("");
    try {
      const { valid } = await apiVerifyCurrentPassword(currentPw);
      setVerifyStatus(valid ? "valid" : "invalid");
      if (!valid) setVerifyError("Incorrect password");
    } catch {
      setVerifyStatus("invalid");
      setVerifyError("Could not verify password");
    }
  };

  const handleForgot = () => {
    setCurrentPw("");
    setVerifyStatus("idle");
    setVerifyError("");
    setMode("forgot");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validErr = validateNewPassword(newPw, confirmPw);
    if (validErr) {
      setSubmitError(validErr);
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      await resetPasswordAuthenticated(newPw);
      onSuccess();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Current password — hidden when forgot link clicked */}
      {mode === "verify" && (
        <div className="space-y-1.5">
          <div className="relative">
            <input
              ref={currentPwRef}
              type="password"
              value={currentPw}
              onChange={(e) => {
                setCurrentPw(e.target.value);
                if (verifyStatus !== "idle") setVerifyStatus("idle");
                setVerifyError("");
              }}
              onBlur={handleBlur}
              placeholder="Current password"
              autoComplete="current-password"
              className={`${inputClass} pr-9`}
            />
            {verifyStatus === "checking" && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--primary-brown)]/50">
                ...
              </span>
            )}
            {verifyStatus === "valid" && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 text-sm leading-none">
                ✓
              </span>
            )}
          </div>
          {verifyError && <p className="text-xs text-red-400">{verifyError}</p>}
          <button
            type="button"
            onClick={handleForgot}
            className="text-xs transition hover:underline underline-offset-2"
            style={{ color: "#7a6545" }}
          >
            Forgot your password?
          </button>
        </div>
      )}

      {/* New password fields — fade in after correct verify or in forgot mode */}
      <div
        className="overflow-hidden transition-all duration-200"
        style={{ maxHeight: showNewFields ? 160 : 0, opacity: showNewFields ? 1 : 0 }}
      >
        <div className="space-y-3 pt-1">
          <input
            type="password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            placeholder="New password"
            autoComplete="new-password"
            className={inputClass}
          />
          <input
            type="password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            placeholder="Confirm new password"
            autoComplete="new-password"
            className={inputClass}
          />
        </div>
      </div>

      {submitError && <p className="text-xs text-red-400">{submitError}</p>}

      {showNewFields && (
        <ActionButton type="submit" disabled={submitting || !newPw || !confirmPw}>
          {submitting ? "Updating..." : "Update password"}
        </ActionButton>
      )}
    </form>
  );
}

// ---- Main card ----
interface Props {
  user: User;
}

export default function SignInMethodsCard({ user }: Props) {
  const { login } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [justSetPassword, setJustSetPassword] = useState(false);

  // Reflects password status immediately after setup without waiting for prop refresh
  const hasPassword = justSetPassword || user.hasPassword;

  const handleSuccess = async () => {
    await login("refresh");
    setExpanded(false);
    setJustSetPassword(true);
  };

  return (
    <div className="border-t border-[var(--primary-brown)]/30 pt-6">
      <h3 className="text-[var(--light-cream)] font-semibold mb-4">Sign-in Methods</h3>

      <div className="divide-y divide-[var(--primary-brown)]/10">
        {/* Google — only shown if the account has a Google login linked */}
        {user.hasGoogle && (
          <div className="flex items-center justify-between py-3.5">
            <div>
              <p className="text-sm text-[var(--light-cream)] font-medium">Google</p>
              <p className="text-xs text-[var(--primary-brown)]/60 mt-0.5">
                Sign in with your Google account
              </p>
            </div>
            <StatusBadge label="Connected" />
          </div>
        )}

        {/* Magic Link — always available */}
        <div className="flex items-center justify-between py-3.5">
          <div>
            <p className="text-sm text-[var(--light-cream)] font-medium">Magic Link</p>
            <p className="text-xs text-[var(--primary-brown)]/60 mt-0.5">
              One-time code sent to your email
            </p>
          </div>
          <StatusBadge label="Active" />
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center justify-between py-3.5">
            <div>
              <p className="text-sm text-[var(--light-cream)] font-medium">Password</p>
              <p className="text-xs text-[var(--primary-brown)]/60 mt-0.5">
                {hasPassword ? "Sign in with your password" : "No password set"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {hasPassword && !expanded && <StatusBadge label="Active" />}
              {!expanded ? (
                <ActionButton onClick={() => setExpanded(true)}>
                  {hasPassword ? "Change" : "Set up"}
                </ActionButton>
              ) : (
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="text-xs text-[var(--primary-brown)]/50 hover:text-[var(--primary-brown)] transition"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          {/* Inline flow panel */}
          <div
            className="overflow-hidden transition-all duration-200"
            style={{ maxHeight: expanded ? 500 : 0, opacity: expanded ? 1 : 0 }}
          >
            <div className="pb-4">
              {expanded &&
                (!hasPassword ? (
                  <SetupFlow user={user} onSuccess={handleSuccess} />
                ) : (
                  <ChangeFlow onSuccess={handleSuccess} />
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
