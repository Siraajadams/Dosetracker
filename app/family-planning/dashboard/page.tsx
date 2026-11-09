
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

type StaffProfile = {
  approval_status: string | null;
  is_active: boolean | null;
};

type Module = {
  title: string;
  description: string;
  href: string;
  icon: string;
};


const modules: Module[] = [
  {
    title: "Patient Management",
    description:
      "Review and update patients registered across different facilities.",
    href: "/family-planning/patients",
    icon: "👥",
  },
  {
    title: "Contraceptive Analytics",
    description:
      "Monitor medication administrations, top 10 medications and adverse events.",
    href: "/family-planning/medications",
    icon: "💉",
  },
  {
    title: "Follow-up Appointments",
    description:
      "Manage appointment calendars, follow-ups and adherence.",
    href: "/family-planning/appointments",
    icon: "📅",
  },
  {
    title: "Inventory Management",
    description:
      "Review stock on hand, reorders and monthly inventory by facility.",
    href: "/family-planning/inventory",
    icon: "📦",
  },
  {
    title: "Clinical Reports",
    description:
      "View monthly facility reports, medication activity and stock usage.",
    href: "/family-planning/reports",
    icon: "📊",
  },
  {
    title: "Nurse Administration",
    description:
      "Review nurse registrations, approve staff and assign nurses to clinics.",
    href: "/admin/nurses",
    icon: "👩‍⚕️",
  },
  {
    title: "Manage Clinics",
    description:
      "Manage facility profiles, MHFL, CFS and Demander numbers.",
    href: "/admin/clinics",
    icon: "🏥",
  },
  {
    title: "Medication Management",
    description:
      "Manage contraceptive medication master data and product details.",
    href: "/admin/medications",
    icon: "💊",
  },
];

  {
    title: "Patient Registration",
    description:
      "Register new patients, capture identification details and maintain patient profiles.",
    href: "/nurse/patients/new",
    icon: "👤",
  },
  {
    title: "Contraceptive Administration",
    description:
      "Search for patients and record contraceptive medication administrations.",
    href: "/nurse/patients",
    icon: "💉",
  },
  {
    title: "Follow-up Appointments",
    description:
      "Access patient records to review follow-up dates and contraceptive schedules.",
    href: "/nurse/patients",
    icon: "📅",
  },
  {
    title: "Inventory Management",
    description:
      "Access the contraceptive inventory management module.",
    href: "/family-planning/inventory",
    icon: "📦",
  },
  {
    title: "Clinical Reports",
    description:
      "Access facility-level family planning activity and reporting.",
    href: "/family-planning/reports",
    icon: "📊",
  },
];

export default function FamilyPlanningDashboard() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [membership, setMembership] =
    useState<Membership | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [message, setMessage] = useState("");
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function checkAccess() {
      try {
        const { data, error } =
          await supabase.auth.getUser();

        if (cancelled) return;

        if (error || !data.user) {
          router.replace("/family-planning/login");
          return;
        }

        setUserEmail(data.user.email ?? "");

        // Check Super Admin privileges independently.
        const adminResult =
          await supabase.rpc("dt_is_super_admin");

        if (cancelled) return;

        if (
          !adminResult.error &&
          adminResult.data === true
        ) {
          setIsSuperAdmin(true);
          return;
        }

        if (adminResult.error) {
          setMessage(
            "Unable to verify administrator permissions."
          );
          return;
        }

        // Confirm staff approval and activation.
        const profileResult = await supabase
          .from("staff_profiles")
          .select("approval_status, is_active")
          .eq("id", data.user.id)
          .maybeSingle();

        if (cancelled) return;

        if (profileResult.error) {
          setMessage(
            "Unable to verify your staff profile."
          );
          return;
        }

        const profile =
          profileResult.data as StaffProfile | null;

        if (
          !profile ||
          profile.approval_status !== "approved" ||
          profile.is_active !== true
        ) {
          setMessage(
            "Your account is awaiting administrator approval and activation."
          );
          return;
        }

        // Only active, assigned clinic memberships.
        const membershipResult = await supabase
          .from("fp_memberships")
          .select("facility_id, role, active")
          .eq("user_id", data.user.id)
          .eq("active", true);

        if (cancelled) return;

        if (membershipResult.error) {
          setMessage(
            "Unable to verify Family Planning clinic permissions."
          );
          return;
        }

        const approved = (
          membershipResult.data ?? []
        ).find((m: Membership) =>
          ["administrator", "nurse", "doctor"].includes(
            m.role
          )
        );

        if (approved) {
          setMembership(approved);
        } else {
          setMessage(
            "Your account is approved but no active clinic has been assigned. Contact the administrator."
          );
        }
      } catch {
        if (!cancelled) {
          setMessage(
            "Unable to verify your account permissions. Please try again."
          );
        }
      } finally {
        if (!cancelled) {
          setChecking(false);
        }
      }
    }

    void checkAccess();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function signOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setMessage(error.message);
      return;
    }

    router.replace("/family-planning/login");
  }

  const card: React.CSSProperties = {
    background: "#ffffff",
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
    border: "1px solid #e2e8f0",
  };

  const button: React.CSSProperties = {
    display: "inline-block",
    padding: "11px 16px",
    borderRadius: 9,
    background: "#0f766e",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 700,
    fontSize: 14,
  };

  if (checking) {
    return (
      <main style={{ padding: 32 }}>
        Checking your Family Planning permissions...
      </main>
    );
  }

  const hasAccess = isSuperAdmin || !!membership;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f0fdfa",
        padding: 24,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1150, margin: "0 auto" }}>
        <header
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            marginBottom: 28,
          }}
        >
          <div>
            <h1
              style={{
                color: "#0f766e",
                marginBottom: 8,
              }}
            >
              DoseTrack Family Planning
            </h1>

            <p style={{ color: "#475569" }}>
              Family Planning Management Dashboard
            </p>
          </div>

          <button
            type="button"
            onClick={() => void signOut()}
            style={{
              padding: "11px 18px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 9,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Sign Out
          </button>
        </header>

        {!hasAccess ? (
          <section
            style={{
              ...card,
              maxWidth: 650,
            }}
          >
            <h2>Clinical access not yet enabled</h2>

            <p style={{ color: "#475569" }}>
              {message}
            </p>

            <Link
              href="/pending-approval"
              style={button}
            >
              View Account Status
            </Link>
          </section>
        ) : (
          <>
            <section
              style={{
                ...card,
                marginBottom: 24,
                background:
                  "linear-gradient(135deg,#ffffff,#ecfdf5)",
              }}
            >
              <h2 style={{ color: "#0f766e" }}>
                Welcome to Family Planning
              </h2>

              <p>
                Signed in as:{" "}
                <strong>{userEmail}</strong>
              </p>

              <p>
                Approved role:{" "}
                <strong>
                  {isSuperAdmin
                    ? "Super Administrator"
                    : membership?.role}
                </strong>
              </p>

              {membership && (
                <p>
                  Facility ID:{" "}
                  <strong>
                    {membership.facility_id}
                  </strong>
                </p>
              )}

              {isSuperAdmin && (
                <Link
                  href="/admin"
                  style={button}
                >
                  Open Super Admin Dashboard
                </Link>
              )}
            </section>

            <h2
              style={{
                color: "#0f172a",
                marginBottom: 18,
              }}
            >
              Clinical Modules
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit,minmax(250px,1fr))",
                gap: 18,
              }}
            >
              {modules.map((module) => (
                <section
                  key={module.title}
                  style={card}
                >
                  <div
                    style={{
                      fontSize: 34,
                      marginBottom: 12,
                    }}
                  >
                    {module.icon}
                  </div>

                  <h3
                    style={{
                      color: "#0f766e",
                      marginTop: 0,
                    }}
                  >
                    {module.title}
                  </h3>

                  <p
                    style={{
                      color: "#475569",
                      lineHeight: 1.6,
                      minHeight: 75,
                    }}
                  >
                    {module.description}
                  </p>

                  <Link
                    href={module.href}
                    style={button}
                  >
                    Open Module →
                  </Link>
                </section>
              ))}

              {isSuperAdmin && (
                <section style={card}>
                  <div
                    style={{
                      fontSize: 34,
                      marginBottom: 12,
                    }}
                  >
                    🛡️
                  </div>

                  <h3 style={{ color: "#0f766e" }}>
                    Staff Administration
                  </h3>

                  <p
                    style={{
                      color: "#475569",
                      lineHeight: 1.6,
                      minHeight: 75,
                    }}
                  >
                    Approve nurse registrations,
                    manage facilities and assign
                    staff to clinics.
                  </p>

                  <Link
                    href="/admin"
                    style={button}
                  >
                    Open Administration →
                  </Link>
                </section>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
