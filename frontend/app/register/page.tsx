"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { registerUser } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    password: "",
    confirmPassword: "",
    agreeToTerms: false,
  });
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      await registerUser({
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phoneNumber: formData.phoneNumber,
      });
      await login(); // Trigger a state refresh in the context
      router.push("/");
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
    <div className="flex justify-center pt-20 pb-24 px-4">
      <div className="w-full max-w-[900px] min-w-[640px] rounded-[20px] border border-[#bfa68a] bg-white/5 backdrop-blur-xl px-12 py-14 shadow-lg">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-playfair text-[#F9F6F2]">Join Tourbillon</h1>
          <p className="text-[#bfa68a] mt-2 text-sm">
            Create your account and explore exclusive collections
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Input rows */}
          <div className="grid grid-cols-2 gap-6">
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              placeholder="First Name"
              className="h-10 px-4 rounded-md border border-[#bfa68a] text-[#bfa68a] bg-transparent placeholder-[#bfa68a]/70 focus:outline-none"
              required
            />
            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              placeholder="Last Name"
              className="h-10 px-4 rounded-md border border-[#bfa68a] text-[#bfa68a] bg-transparent placeholder-[#bfa68a]/70 focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Email"
              className="h-10 px-4 rounded-md border border-[#bfa68a] text-[#bfa68a] bg-transparent placeholder-[#bfa68a]/70 focus:outline-none"
              required
            />
            <input
              type="text"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleChange}
              placeholder="Phone Number"
              className="h-10 px-4 rounded-md border border-[#bfa68a] text-[#bfa68a] bg-transparent placeholder-[#bfa68a]/70 focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Password"
              className="h-10 px-4 rounded-md border border-[#bfa68a] text-[#bfa68a] bg-transparent placeholder-[#bfa68a]/70 focus:outline-none"
              required
            />
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Confirm Password"
              className="h-10 px-4 rounded-md border border-[#bfa68a] text-[#bfa68a] bg-transparent placeholder-[#bfa68a]/70 focus:outline-none"
              required
            />
          </div>

          {error && <p className="text-sm text-red-500 text-center">{error}</p>}

          {/* Checkbox */}
          <div className="flex items-center gap-3 mt-4 text-sm text-[#bfa68a]">
            <input
              type="checkbox"
              name="agreeToTerms"
              checked={formData.agreeToTerms}
              onChange={handleChange}
              className="accent-[#bfa68a] w-5 h-5"
              required
            />
            <span>
              I agree to{" "}
              <Link href="#" className="underline hover:text-[#F9F6F2]">
                Terms of Service
              </Link>
            </span>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full py-3 rounded-xl font-semibold bg-gradient-to-r from-[#bfa68a] to-[#f0e6d2] text-[#1e1512] hover:opacity-90 transition"
          >
            Register
          </button>

          {/* Sign in */}
          <p className="text-center text-sm text-[#bfa68a] mt-2">
            Already have an account?{" "}
            <Link href="/login" className="underline hover:text-[#F9F6F2]">
              Sign In
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
