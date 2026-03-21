// This page orchestrates the edit details functionality using separate components
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import StaggeredFade from "../../scrollMotion/StaggeredFade";
import WatchDnaForm from "./WatchDnaForm";
import UpdateDetailsForm from "./UpdateDetailsForm";
import ChangePasswordForm from "./ChangePasswordForm";
import DeleteAccountForm from "./DeleteAccountForm";

export default function EditDetailsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) return null;

  return (
    <StaggeredFade>
      <div className="flex justify-center pt-20 pb-24 px-4">
        <div className="w-full max-w-[900px] min-w-[640px] rounded-[20px] border border-[var(--primary-brown)] bg-white/5 backdrop-blur-xl px-12 py-14 shadow-lg">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-playfair text-[var(--light-cream)]">Edit Profile</h1>
            <p className="text-[var(--primary-brown)] mt-2 text-sm">
              Update your personal information and preferences
            </p>
          </div>

          {/* Watch DNA — taste-based personalisation, placed first */}
          <WatchDnaForm />

          {/* Update Details Form */}
          <UpdateDetailsForm user={user} />

          {/* Change Password Form */}
          <div className="mt-8">
            <ChangePasswordForm user={user} />
          </div>

          {/* Delete Account Form */}
          <div className="mt-8">
            <DeleteAccountForm />
          </div>
        </div>
      </div>
    </StaggeredFade>
  );
} 