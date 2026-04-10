// This component handles changing user passwords with security verification
"use client";
import { useState } from "react";
import { updateUser, User } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

interface ChangePasswordFormProps {
  user: User;
}

export default function ChangePasswordForm({ user }: ChangePasswordFormProps) {
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    
    // Clear error when user starts typing
    if (error) setError("");
    if (success) setSuccess("");
  };

  const validatePasswordForm = () => {
    // Require current password when changing password
    if (!formData.currentPassword) {
      setError("Please enter your current password to change it");
      return false;
    }

    // Validate new password length (backend requires 8 characters)
    if (formData.newPassword.length < 8) {
      setError("New password must be at least 8 characters long");
      return false;
    }

    // Validate new password requirements (backend requires digit and uppercase)
    if (!/\d/.test(formData.newPassword)) {
      setError("New password must contain at least one digit");
      return false;
    }

    if (!/[A-Z]/.test(formData.newPassword)) {
      setError("New password must contain at least one uppercase letter");
      return false;
    }

    // Validate confirm password
    if (!formData.confirmPassword) {
      setError("Please confirm your new password");
      return false;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError("New passwords do not match");
      return false;
    }

    // Ensure new password is different from current password
    if (formData.newPassword === formData.currentPassword) {
      setError("New password must be different from current password");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!validatePasswordForm()) {
      return;
    }

    try {
      console.log("Attempting password change...");
      console.log("Form data:", { 
        currentPassword: formData.currentPassword ? "***" : "empty",
        newPassword: formData.newPassword ? "***" : "empty",
        confirmPassword: formData.confirmPassword ? "***" : "empty"
      });
      
      const result = await updateUser({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        address: user.address,
        city: user.city,
        state: user.state,
        country: user.country,
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      });
      
      console.log("Password change result:", result);
      
      // Check if there was an error
      if (result.error) {
        setError(result.error);
        return;
      }
      
      // Show success message
      setSuccess("Password changed successfully!");
      await login('refresh'); // Refresh user data
      
      // Clear password fields after successful update
      setFormData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err) {
      console.error("Unexpected error:", err);
      setError("An unexpected error occurred.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Password Change Section */}
      <div className="border-t border-[var(--primary-brown)]/30 pt-6">
        <h3 className="text-[var(--light-cream)] font-semibold mb-4">Change Password</h3>
        <p className="text-[var(--primary-brown)] text-sm mb-4">
          To change your password, please enter your current password for security verification, then provide your new password.
        </p>
        <div className="grid grid-cols-1 gap-6">
          <input
            type="password"
            name="currentPassword"
            value={formData.currentPassword}
            onChange={handleChange}
            placeholder="Current Password"
            autoComplete="current-password"
            className="h-10 px-4 rounded-md border border-[var(--primary-brown)] text-[var(--primary-brown)] bg-transparent placeholder-[var(--primary-brown)]/70 focus:outline-none"
          />
          <div className="grid grid-cols-2 gap-6">
            <input
              type="password"
              name="newPassword"
              value={formData.newPassword}
              onChange={handleChange}
              placeholder="New Password"
              autoComplete="new-password"
              className="h-10 px-4 rounded-md border border-[var(--primary-brown)] text-[var(--primary-brown)] bg-transparent placeholder-[var(--primary-brown)]/70 focus:outline-none"
            />
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Confirm New Password"
              autoComplete="new-password"
              className="h-10 px-4 rounded-md border border-[var(--primary-brown)] text-[var(--primary-brown)] bg-transparent placeholder-[var(--primary-brown)]/70 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Change Password Button */}
      <button
        type="submit"
        className="w-full py-3 rounded-xl font-semibold bg-gradient-to-r from-[var(--primary-brown)] to-[var(--cream-gold)] text-[var(--dark-brown)] hover:opacity-90 transition cursor-pointer"
      >
        Change Password
      </button>

      {error && <p className="text-sm text-red-500 text-center">{error}</p>}
      {success && <p className="text-sm text-green-500 text-center">{success}</p>}
    </form>
  );
} 
