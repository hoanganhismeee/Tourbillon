"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { registerUser } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import StaggeredFade from "../scrollMotion/StaggeredFade";

const GOOGLE_AUTH_URL = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5248/api'}/authentication/google`;

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
        [name]: type === "checkbox" ? checked : value,
      }));
    }
    
    // Clear error when user starts typing
    if (error) setError("");
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

    // Validate password
    if (!formData.password) {
      setError("Please enter a password");
      return false;
    }

    // Validate confirm password
    if (!formData.confirmPassword) {
      setError("Please confirm your password");
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return false;
    }

    // Validate terms of service
    if (!formData.agreeToTerms) {
      setError("You must agree to our Terms of Service");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!validateForm()) {
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
    <StaggeredFade>
    <div className="flex justify-center pt-20 pb-24 px-4">
             <div className="w-full max-w-[900px] min-w-[640px] rounded-[20px] border border-[var(--primary-brown)] bg-white/5 backdrop-blur-xl px-12 py-14 shadow-lg">
         <div className="text-center mb-10">
           <h1 className="text-4xl font-playfair text-[var(--light-cream)]">Join Tourbillon</h1>
           <p className="text-[var(--primary-brown)] mt-2 text-sm">
             Create your account and explore exclusive collections
           </p>
         </div>

        {/* Google sign-in — full navigation, not fetch */}
        <a
          href={GOOGLE_AUTH_URL}
          className="flex items-center justify-center gap-3 w-full py-2 rounded-xl border border-[var(--primary-brown)] text-[var(--primary-brown)] hover:bg-white/5 transition text-sm font-medium mb-6"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.198 2.698 1.24 6.65l4.026 3.115Z"/>
            <path fill="#34A853" d="M16.04 18.013c-1.09.703-2.474 1.078-4.04 1.078a7.077 7.077 0 0 1-6.723-4.823l-4.04 3.067A11.965 11.965 0 0 0 12 24c2.933 0 5.735-1.043 7.834-3l-3.793-2.987Z"/>
            <path fill="#4A90D9" d="M19.834 21c2.195-2.048 3.62-5.096 3.62-9 0-.71-.109-1.473-.272-2.182H12v4.637h6.436c-.317 1.559-1.17 2.766-2.395 3.558L19.834 21Z"/>
            <path fill="#FBBC05" d="M5.277 14.268A7.12 7.12 0 0 1 4.909 12c0-.782.125-1.533.357-2.235L1.24 6.65A11.934 11.934 0 0 0 0 12c0 1.92.445 3.73 1.237 5.335l4.04-3.067Z"/>
          </svg>
          Continue with Google
        </a>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-[var(--primary-brown)]/30" />
          <span className="text-xs text-[var(--primary-brown)]/60">or register with email</span>
          <div className="flex-1 h-px bg-[var(--primary-brown)]/30" />
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

                     <div className="grid grid-cols-2 gap-6">
             <input
               type="password"
               name="password"
               value={formData.password}
               onChange={handleChange}
               placeholder="Password"
               autoComplete="on"
               className="h-10 px-4 rounded-md border border-[var(--primary-brown)] text-[var(--primary-brown)] bg-transparent placeholder-[var(--primary-brown)]/70 focus:outline-none"
             />
             <input
               type="password"
               name="confirmPassword"
               value={formData.confirmPassword}
               onChange={handleChange}
               placeholder="Confirm Password"
               autoComplete="on"
               className="h-10 px-4 rounded-md border border-[var(--primary-brown)] text-[var(--primary-brown)] bg-transparent placeholder-[var(--primary-brown)]/70 focus:outline-none"
             />
           </div>

          {error && <p className="text-sm text-red-500 text-center">{error}</p>}

                               {/* Checkbox */}
           <div className="flex items-center gap-3 mt-4 text-sm text-[var(--primary-brown)]">
             <input
               type="checkbox"
               id="agreeToTerms"
               name="agreeToTerms"
               checked={formData.agreeToTerms}
               onChange={handleChange}
               className="accent-[var(--primary-brown)] w-5 h-5"
             />
            <label 
              htmlFor="agreeToTerms" 
              className="cursor-pointer flex items-center gap-1"
            >
              <span>I agree to</span>
                             <Link 
                 href="#" 
                 className="underline hover:text-[var(--light-cream)]"
                 onClick={(e) => {
                   e.preventDefault();
                   e.stopPropagation();
                   // Toggle the checkbox state directly
                   setFormData(prev => ({
                     ...prev,
                     agreeToTerms: !prev.agreeToTerms
                   }));
                   // Clear any existing error
                   if (error) setError("");
                 }}
               >
                 Terms of Service
               </Link>
            </label>
          </div>

          {/* Submit */}
                     <button
             type="submit"
             className="w-full py-3 rounded-xl font-semibold bg-gradient-to-r from-[var(--primary-brown)] to-[var(--cream-gold)] text-[var(--dark-brown)] hover:opacity-90 transition cursor-pointer"
           >
             Register
           </button>

          {/* Sign in */}
                     <p className="text-center text-sm text-[var(--primary-brown)] mt-2">
             Already have an account?{" "}
             <Link href="/login" className="underline hover:text-[var(--light-cream)] cursor-pointer">
               Sign In
             </Link>
           </p>
        </form>
      </div>
    </div>
    </StaggeredFade>
  );
}
