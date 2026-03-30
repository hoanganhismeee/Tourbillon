// User-facing page showing all submitted inquiries, appointments, and interest registrations.
// Status auto-advances from Received → In Review after 30 minutes via Hangfire.
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import StaggeredFade from "../../scrollMotion/StaggeredFade";
import {
  getMyContactInquiries,
  getMyAppointments,
  getMyRegisterInterests,
  MyContactInquiry,
  MyAppointment,
  MyRegisterInterest,
} from "@/lib/api";

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-[#bfa68a]/20 text-[#bfa68a] border border-[#bfa68a]/40">
      {status}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function InquiriesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [inquiries, setInquiries] = useState<MyContactInquiry[]>([]);
  const [appointments, setAppointments] = useState<MyAppointment[]>([]);
  const [interests, setInterests] = useState<MyRegisterInterest[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getMyContactInquiries(),
      getMyAppointments(),
      getMyRegisterInterests(),
    ])
      .then(([i, a, r]) => {
        setInquiries(i);
        setAppointments(a);
        setInterests(r);
      })
      .finally(() => setFetching(false));
  }, [user]);

  if (loading || !user) return null;

  const empty =
    !fetching &&
    inquiries.length === 0 &&
    appointments.length === 0 &&
    interests.length === 0;

  return (
    <StaggeredFade>
      <div className="flex justify-center pt-20 pb-24 px-4">
        <div className="w-full max-w-[900px] min-w-[320px] rounded-[20px] border border-[var(--primary-brown)] bg-white/5 backdrop-blur-xl px-8 py-12 shadow-lg">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-playfair text-[var(--light-cream)]">
              My Inquiries
            </h1>
            <p className="text-[var(--primary-brown)] mt-2 text-sm">
              Track your contact requests, appointments, and watch interest
              registrations
            </p>
          </div>

          {fetching && (
            <p className="text-center text-[var(--primary-brown)] text-sm">
              Loading...
            </p>
          )}
          {empty && (
            <p className="text-center text-[var(--primary-brown)] text-sm">
              No inquiries yet. Browse watches and contact our advisors to get
              started.
            </p>
          )}

          {inquiries.length > 0 && (
            <Section title="Contact Advisor">
              {inquiries.map((i) => (
                <Card key={i.id}>
                  <CardRow
                    label="Watch"
                    value={
                      [i.watchName, i.watchReference]
                        .filter(Boolean)
                        .join(" · ") || "General inquiry"
                    }
                  />
                  <CardRow label="Message" value={i.message} />
                  <CardRow label="Submitted" value={formatDate(i.createdAt)} />
                  <div className="mt-2">
                    <StatusBadge status={i.status} />
                  </div>
                </Card>
              ))}
            </Section>
          )}

          {appointments.length > 0 && (
            <Section title="Appointments">
              {appointments.map((a) => (
                <Card key={a.id}>
                  <CardRow label="Boutique" value={a.boutiqueName} />
                  <CardRow label="Purpose" value={a.visitPurpose} />
                  {a.brandName && (
                    <CardRow label="Brand" value={a.brandName} />
                  )}
                  <CardRow
                    label="Date"
                    value={formatDate(a.appointmentDate)}
                  />
                  <CardRow label="Submitted" value={formatDate(a.createdAt)} />
                  <div className="mt-2">
                    <StatusBadge status={a.status} />
                  </div>
                </Card>
              ))}
            </Section>
          )}

          {interests.length > 0 && (
            <Section title="Register Interest">
              {interests.map((r) => (
                <Card key={r.id}>
                  {r.brandName && (
                    <CardRow label="Brand" value={r.brandName} />
                  )}
                  {r.collectionName && (
                    <CardRow label="Collection" value={r.collectionName} />
                  )}
                  {(r.watchDescription || r.watchReference) && (
                    <CardRow
                      label="Watch"
                      value={[r.watchDescription, r.watchReference]
                        .filter(Boolean)
                        .join(" · ")}
                    />
                  )}
                  <CardRow label="Submitted" value={formatDate(r.createdAt)} />
                  <div className="mt-2">
                    <StatusBadge status={r.status} />
                  </div>
                </Card>
              ))}
            </Section>
          )}
        </div>
      </div>
    </StaggeredFade>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-10">
      <h2 className="text-lg font-playfair text-[var(--light-cream)] mb-4 border-b border-[#bfa68a]/30 pb-2">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#bfa68a]/20 bg-white/5 px-5 py-4">
      {children}
    </div>
  );
}

function CardRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 text-sm mb-1">
      <span className="text-[var(--primary-brown)] w-24 shrink-0">{label}</span>
      <span className="text-[var(--light-cream)]">{value}</span>
    </div>
  );
}
