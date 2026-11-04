
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Membership = {
  facility_id: string;
  role: string;
  active: boolean;
};

export default function FamilyPlanningDashboard() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function checkAccess() {
      const { data, error } = await supabase.auth.getUser();
      if (cancelled) return;

      if (error || !data.user) {
        router.replace("/family-planning/login");
        return;
      }

      const result = await supabase
        .from("fp_memberships")
        .select("facility_id, role, active")
        .eq("user_id", data.user.id)
        .eq("active", true);

      if (cancelled) return;

      if (result.error) {
        setMessage("Unable to verify Family Planning permissions.");
      } else {
        const approved = (result.data ?? []).find((m) =>
          ["super_admin", "administrator", "nurse", "doctor"].includes(m.role)
        );

        if (approved) {
          setMembership(approved);
        } else {
          setMessage("Your account is awaiting administrator approval.");
        }
      }

      setChecking(false);
    }

    void checkAccess();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (checking) {
    return <main style={{ padding: 32 }}>Checking your permissions...</main>;
  }

  const card: React.CSSProperties = {
    background: "white",
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 2px 12px #00000010",
  };

  const modules = [
    {
      title: "Patient Registration",
      description: "Register patients and capture identification details.",
      href: "/family-planning/patients/register",
      ready: true,
    },
    {
      title: "Contraceptive Administration",
      description: "Record injections, batch numbers and adverse events.",
      ready: false,
    },
    {
      title: "Follow-up Appointments",
      description: "Manage next injection dates and patient reminders.",
      ready: false,
    },
    {
      title: "Inventory Management",
      description: "Monitor contraceptive stock and expiry dates.",
      ready: false,
    },
    {
      title: "Clinical Reports",
      description: "Review facility-level Family Planning activity.",
      ready: false,
    },
  ];

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f0fdfa",
        padding: 24,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <h1 style={{ color: "#0f766e" }}>DoseTrack Family Planning</h1>
        <p>Family Planning Management Dashboard</p>

        {!membership ? (
          <section style={{ ...card, maxWidth: 650 }}>
            <h2>Clinical access not yet enabled</h2>
            <p>{message}</p>
          </section>
        ) : (
          <>
            <section style={{ ...card, marginBottom: 24 }}>
              <h2>Welcome to Family Planning</h2>
              <p>
                Approved role: <strong>{membership.role}</strong>
              </p>
              <p>Facility ID: {membership.facility_id}</p>
            </section>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 16,
              }}
            >
              {modules.map((module) => (
                <section key={module.title} style={card}>
                  <h3 style={{ color: "#0f766e" }}>{module.title}</h3>
                  <p>{module.description}</p>
                  {module.ready && module.href ? (
                    <Link
                      href={module.href}
                      style={{
                        display: "inline-block",
                        padding: "10px 16px",
                        borderRadius: 8,
                        background: "#0f766e",
                        color: "white",
                        textDecoration: "none",
                      }}
                    >
                      Open module
                    </Link>
                  ) : (
                    <span style={{ color: "#64748b" }}>
                      Coming soon
                    </span>
                  )}
                </section>
              ))}

              {membership.role === "super_admin" && (
                <section style={card}>
                  <h3 style={{ color: "#0f766e" }}>
                    Staff Administration
                  </h3>
                  <p>Review staff registrations and approvals.</p>
                  <span>Existing approval workflow</span>
                </section>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
