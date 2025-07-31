// This component handles updating user profile information (personal details and address)
"use client";
import { useState, useEffect } from "react";
import { updateUser, User } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

interface UpdateDetailsFormProps {
  user: User;
}

export default function UpdateDetailsForm({ user }: UpdateDetailsFormProps) {
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    address: "",
    city: "",
    state: "",
    country: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Load current user data when component mounts
  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        phoneNumber: user.phoneNumber || "",
        address: user.address || "",
        city: user.city || "",
        state: user.state || "",
        country: user.country || "",
      });
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // Special handling for phone number - only allow numbers
    if (name === "phoneNumber") {
      const numericValue = value.replace(/[^0-9]/g, '');
      setFormData((prev) => ({
        ...prev,
        [name]: numericValue,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
    
    // Clear error when user starts typing
    if (error) setError("");
    if (success) setSuccess("");
  };

  const validateForm = () => {
    // Validate first name and last name
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError("Please enter your full name");
      return false;
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError("Email is not valid");
      return false;
    }

    // Validate phone number
    if (!formData.phoneNumber.trim()) {
      setError("Please enter your phone number");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!validateForm()) {
      return;
    }

    try {
      await updateUser({
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phoneNumber: formData.phoneNumber,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        country: formData.country,
      });
      
      setSuccess("Profile updated successfully!");
      await login(); // Refresh user data
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred.");
      }
      console.error(err);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Personal Information */}
      <div className="grid grid-cols-2 gap-6">
        <input
          type="text"
          name="firstName"
          value={formData.firstName}
          onChange={handleChange}
          placeholder="First Name"
          className="h-10 px-4 rounded-md border border-[var(--primary-brown)] text-[var(--primary-brown)] bg-transparent placeholder-[var(--primary-brown)]/70 focus:outline-none"
        />
        <input
          type="text"
          name="lastName"
          value={formData.lastName}
          onChange={handleChange}
          placeholder="Last Name"
          className="h-10 px-4 rounded-md border border-[var(--primary-brown)] text-[var(--primary-brown)] bg-transparent placeholder-[var(--primary-brown)]/70 focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <input
          type="text"
          name="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="Email"
          className="h-10 px-4 rounded-md border border-[var(--primary-brown)] text-[var(--primary-brown)] bg-transparent placeholder-[var(--primary-brown)]/70 focus:outline-none"
        />
        <input
          type="tel"
          name="phoneNumber"
          value={formData.phoneNumber}
          onChange={handleChange}
          placeholder="Phone Number"
          className="h-10 px-4 rounded-md border border-[var(--primary-brown)] text-[var(--primary-brown)] bg-transparent placeholder-[var(--primary-brown)]/70 focus:outline-none"
          pattern="[0-9]*"
          inputMode="numeric"
        />
      </div>

      {/* Address Information */}
      <div className="grid grid-cols-1 gap-6">
        <input
          type="text"
          name="address"
          value={formData.address}
          onChange={handleChange}
          placeholder="Address"
          className="h-10 px-4 rounded-md border border-[var(--primary-brown)] text-[var(--primary-brown)] bg-transparent placeholder-[var(--primary-brown)]/70 focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <input
          type="text"
          name="city"
          value={formData.city}
          onChange={handleChange}
          placeholder="City"
          className="h-10 px-4 rounded-md border border-[var(--primary-brown)] text-[var(--primary-brown)] bg-transparent placeholder-[var(--primary-brown)]/70 focus:outline-none"
        />
        <input
          type="text"
          name="state"
          value={formData.state}
          onChange={handleChange}
          placeholder="State/Province"
          className="h-10 px-4 rounded-md border border-[var(--primary-brown)] text-[var(--primary-brown)] bg-transparent placeholder-[var(--primary-brown)]/70 focus:outline-none"
        />
        <input
          type="text"
          name="country"
          value={formData.country}
          onChange={handleChange}
          placeholder="Country"
          className="h-10 px-4 rounded-md border border-[var(--primary-brown)] text-[var(--primary-brown)] bg-transparent placeholder-[var(--primary-brown)]/70 focus:outline-none"
        />
      </div>

      {/* Update Profile Button */}
      <button
        type="submit"
        className="w-full py-3 rounded-xl font-semibold bg-gradient-to-r from-[var(--primary-brown)] to-[var(--cream-gold)] text-[var(--dark-brown)] hover:opacity-90 transition cursor-pointer"
      >
        Update Profile
      </button>

      {error && <p className="text-sm text-red-500 text-center">{error}</p>}
      {success && <p className="text-sm text-green-500 text-center">{success}</p>}
    </form>
  );
} 