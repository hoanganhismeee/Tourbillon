// This component handles secure account deletion with password verification
"use client";
import { useState } from "react";
import { deleteAccount } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

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
    
    // Clear error when user starts typing
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

    if (!validateDeleteForm()) {
      return;
    }

    if (!showDeleteConfirmation) {
      setShowDeleteConfirmation(true);
      return;
    }

    try {
      const result = await deleteAccount({
        currentPassword: deleteData.currentPassword,
        confirmPassword: deleteData.confirmPassword,
      });
      
      // Check if there was an error
      if (result.error) {
        setDeleteError(result.error);
        return;
      }
      
      // Account deleted successfully, logout and redirect
      await logout();
      window.location.href = "/";
    } catch (err) {
      console.error("Unexpected error:", err);
      setDeleteError("An unexpected error occurred during account deletion.");
    }
  };

  return (
    <div className="border-t border-red-500/30 pt-6">
      <h3 className="text-red-400 font-semibold mb-4">Danger Zone - Delete Account</h3>
      <p className="text-red-300 text-sm mb-4">
        Once you delete your account, there is no going back. Please be certain.
      </p>
      
      <form onSubmit={handleDeleteAccount} className="space-y-4">
        <div className="grid grid-cols-2 gap-6">
          <input
            type="password"
            name="currentPassword"
            value={deleteData.currentPassword}
            onChange={handleDeleteChange}
            placeholder="Current Password"
            autoComplete="current-password"
            className="h-10 px-4 rounded-md border border-red-500/50 text-[var(--primary-brown)] bg-transparent placeholder-[var(--primary-brown)]/70 focus:outline-none"
          />
          <input
            type="password"
            name="confirmPassword"
            value={deleteData.confirmPassword}
            onChange={handleDeleteChange}
            placeholder="Confirm Current Password"
            autoComplete="current-password"
            className="h-10 px-4 rounded-md border border-red-500/50 text-[var(--primary-brown)] bg-transparent placeholder-[var(--primary-brown)]/70 focus:outline-none"
          />
        </div>
        
        {deleteError && <p className="text-sm text-red-400 text-center">{deleteError}</p>}
        
        <button
          type="submit"
          className="w-full py-3 rounded-xl font-semibold bg-gradient-to-r from-red-800 to-red-900 text-white hover:from-red-900 hover:to-red-950 transition cursor-pointer"
        >
          {showDeleteConfirmation ? "Click again to confirm deletion" : "Delete Account"}
        </button>
      </form>
    </div>
  );
} 