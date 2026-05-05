// Profile details form for account settings.
"use client";

import { useEffect, useState } from "react";
import { updateUser, User } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { AUSTRALIAN_STATES } from "@/lib/states";

interface UpdateDetailsFormProps {
  user: User;
}

function FieldInput({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder,
  inputMode,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  placeholder?: string;
  inputMode?: "none" | "text" | "tel" | "url" | "email" | "numeric" | "decimal" | "search";
}) {
  const [focused, setFocused] = useState(false);

  return (
    <label className="block">
      <span className="mb-2 block text-[8.5px] uppercase tracking-[0.28em] text-[#bfa68a]/65">
        {label}
      </span>
      <span className="relative block">
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          inputMode={inputMode}
          className="w-full border-b border-white/15 bg-transparent py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none"
        />
        <span
          className="absolute bottom-0 left-0 h-px origin-left bg-[#bfa68a]/70 transition-transform duration-300"
          style={{ width: "100%", transform: focused ? "scaleX(1)" : "scaleX(0)" }}
        />
      </span>
    </label>
  );
}

function SelectField({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <label className="block">
      <span className="mb-2 block text-[8.5px] uppercase tracking-[0.28em] text-[#bfa68a]/65">
        {label}
      </span>
      <span className="relative block">
        <select
          name={name}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="w-full border-b border-white/15 bg-transparent py-2.5 text-sm text-white focus:outline-none"
        >
          {AUSTRALIAN_STATES.map((state) => (
            <option key={state.value} value={state.value} className="bg-[#2b211d] text-[#f0e6d2]">
              {state.label}
            </option>
          ))}
        </select>
        <span
          className="absolute bottom-0 left-0 h-px origin-left bg-[#bfa68a]/70 transition-transform duration-300"
          style={{ width: "100%", transform: focused ? "scaleX(1)" : "scaleX(0)" }}
        />
      </span>
    </label>
  );
}

export default function UpdateDetailsForm({ user }: UpdateDetailsFormProps) {
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    dateOfBirth: "",
    address: "",
    city: "",
    state: "",
    country: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFormData({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      phoneNumber: user.phoneNumber || "",
      dateOfBirth: user.dateOfBirth || "",
      address: user.address || "",
      city: user.city || "",
      state: user.state || "",
      country: user.country || "",
    });
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "phoneNumber" ? value.replace(/[^0-9]/g, "") : value,
    }));

    if (error) setError("");
    if (success) setSuccess("");
  };

  const validateForm = () => {
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError("Please enter your full name");
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError("Email is not valid");
      return false;
    }

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

    if (!validateForm()) return;

    setSaving(true);
    try {
      const result = await updateUser({
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phoneNumber: formData.phoneNumber,
        dateOfBirth: formData.dateOfBirth,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        country: formData.country,
      });

      if (result?.error) {
        setError(result.error);
        return;
      }

      setSuccess("Profile updated.");
      await login("refresh");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <div className="mb-7">
        <p className="text-[9px] uppercase tracking-[0.36em] text-[#bfa68a]">Profile</p>
        <h2 className="mt-2 font-playfair text-2xl font-light text-[#f0e6d2]">Personal Details</h2>
        <p className="mt-2 text-xs leading-relaxed text-white/35">
          Keep your contact information current for appointments, orders, and private advisory.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-7">
        <div className="grid gap-6 md:grid-cols-2">
          <FieldInput label="First name" name="firstName" value={formData.firstName} onChange={handleChange} />
          <FieldInput label="Last name" name="lastName" value={formData.lastName} onChange={handleChange} />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <FieldInput label="Email address" name="email" type="email" value={formData.email} onChange={handleChange} />
          <FieldInput
            label="Phone number"
            name="phoneNumber"
            type="tel"
            value={formData.phoneNumber}
            onChange={handleChange}
            inputMode="numeric"
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <FieldInput
            label="Date of birth"
            name="dateOfBirth"
            type="date"
            value={formData.dateOfBirth}
            onChange={handleChange}
          />
          <SelectField label="State" name="state" value={formData.state} onChange={handleChange} />
        </div>

        <FieldInput label="Address" name="address" value={formData.address} onChange={handleChange} />

        <div className="grid gap-6 md:grid-cols-2">
          <FieldInput label="City" name="city" value={formData.city} onChange={handleChange} />
          <FieldInput label="Country" name="country" value={formData.country} onChange={handleChange} />
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 text-[9.5px] font-medium uppercase tracking-[0.28em] text-[#1e1206] transition-all duration-500 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:px-8"
            style={{
              background: "linear-gradient(105deg, #bfa68a 0%, #d4b898 50%, #bfa68a 100%)",
              backgroundSize: "200% 100%",
            }}
          >
            {saving ? "Saving..." : "Update profile"}
          </button>
          {error && <p className="text-sm text-[#e07575]">{error}</p>}
          {success && <p className="text-sm text-[#bfa68a]/80">{success}</p>}
        </div>
      </form>
    </section>
  );
}
