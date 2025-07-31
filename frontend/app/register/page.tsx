"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { registerUser } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import StaggeredFade from "../scrollMotion/StaggeredFade";

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
               className="h-10 px-4 rounded-md border border-[var(--primary-brown)] text-[var(--primary-brown)] bg-transparent placeholder-[var(--primary-brown)]/70 focus:outline-none"
             />
             <input
               type="password"
               name="confirmPassword"
               value={formData.confirmPassword}
               onChange={handleChange}
               placeholder="Confirm Password"
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
