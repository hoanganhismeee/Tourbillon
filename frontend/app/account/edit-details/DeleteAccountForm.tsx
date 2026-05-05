// Secure account deletion form.
"use client";

import { useState } from "react";
import { deleteAccount } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

function PasswordField({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <label className="block">
      <span className="mb-2 block text-[8.5px] uppercase tracking-[0.28em] text-red-300/60">
        {label}
      </span>
      <span className="relative block">
        <input
          type="password"
          name={name}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoComplete="current-password"
          className="w-full border-b border-red-300/20 bg-transparent py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none"
        />
        <span
          className="absolute bottom-0 left-0 h-px origin-left bg-red-300/70 transition-transform duration-300"
          style={{ width: "100%", transform: focused ? "scaleX(1)" : "scaleX(0)" }}
        />
      </span>
    </label>
  );
}

export default function DeleteAccountForm() {
  const { logout } = useAuth();
  const [deleteData, setDeleteData] = useState({
    currentPassword: "",
    confirmPassword: "",
  });
  const [deleteError, setDeleteError] = useState("");
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

  const handleDeleteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setDeleteData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (deleteError) setDeleteError("");
  };

  const validateDeleteForm = () => {
    if (!deleteData.currentPassword) {
      setDeleteError("Please enter your current password");
      return false;
    }

    if (!deleteData.confirmPassword) {
      setDeleteError("Please confirm your current password");
      return false;
    }

    if (deleteData.currentPassword !== deleteData.confirmPassword) {
      setDeleteError("Password confirmation does not match");
      return false;
    }

    return true;
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError("");

    if (!validateDeleteForm()) return;

    if (!showDeleteConfirmation) {
      setShowDeleteConfirmation(true);
      return;
    }

    try {
      const result = await deleteAccount({
        currentPassword: deleteData.currentPassword,
        confirmPassword: deleteData.confirmPassword,
      });

      if (result.error) {
        setDeleteError(result.error);
        return;
      }

      await logout();
      window.location.href = "/";
    } catch {
      setDeleteError("An unexpected error occurred during account deletion.");
    }
  };

  return (
    <section className="border-t border-red-400/20 pt-9">
      <div className="mb-6">
        <p className="text-[9px] uppercase tracking-[0.36em] text-red-300/70">Danger zone</p>
        <h2 className="mt-2 font-playfair text-2xl font-light text-red-200">Delete Account</h2>
        <p className="mt-2 max-w-xl text-xs leading-relaxed text-red-100/35">
          This permanently removes your profile, saved account details, and access to private account features.
        </p>
      </div>

      <form onSubmit={handleDeleteAccount} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <PasswordField
            label="Current password"
            name="currentPassword"
            value={deleteData.currentPassword}
            onChange={handleDeleteChange}
          />
          <PasswordField
            label="Confirm current password"
            name="confirmPassword"
            value={deleteData.confirmPassword}
            onChange={handleDeleteChange}
          />
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="submit"
            className="w-full border border-red-300/25 py-3 text-[9.5px] font-medium uppercase tracking-[0.28em] text-red-100/75 transition hover:border-red-300/45 hover:text-red-100 sm:w-auto sm:px-8"
          >
            {showDeleteConfirmation ? "Confirm deletion" : "Delete account"}
          </button>
          {deleteError && <p className="text-sm text-[#e07575]">{deleteError}</p>}
          {showDeleteConfirmation && !deleteError && (
            <p className="text-sm text-red-100/45">Press confirm deletion to finish.</p>
          )}
        </div>
      </form>
    </section>
  );
}
