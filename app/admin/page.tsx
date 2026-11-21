
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Module = {
  title: string;
  description: string;
  href: string;
  icon: string;
  section: string;
};

const adminModules: Module[] = [
  {
    title: "Staff Approvals",
    description: "Approve and manage healthcare workers",
    href: "/admin/staff-approvals",
    icon: "👩‍⚕️",
    section: "Administration",
  },
  {
    title: "Manage Clinics",
    description: "Manage MHFL, CFS, Demander and clinic details",
    href: "/admin/clinics",
    icon: "🏥",
    section: "Administration",
  },
  {
    title: "Assign Clinics",
    description: "Assign approved staff to healthcare facilities",
    href: "/admin/assign-clinic",
    icon: "📋",
    section: "Administration",
  },
  {
    title: "Medication Catalogue",
    description: "Manage contraceptives and medication records",
    href: "/admin/medications",
    icon: "💊",
    section: "Programme Management",
  },
  {
    title: "Reporting & Analytics",
    description: "Review facility coverage and contraceptive usage",
    href: "/family-planning/medications/usage",
    icon: "📊",
    section: "Programme Management",
  },
  {
    title: "Clinical Dashboard",
    description: "Open patient and clinical workflows",
    href: "/family-planning/dashboard",
    icon: "🩺",
    section: "Clinical Operations",
  },
];

const sections = [
  "Administration",
  "Programme Management",
  "Clinical Operations",
];

export default function AdminDashboard() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkAdmin() {
      try {
        const { data, error: authError } =
          await supabase.auth.getUser();

        if (cancelled) return;

        if (authError || !data.user) {
          router.replace("/family-planning/login");
          return;
        }

        const { data: isAdmin, error: adminError } =
          await supabase.rpc("dt_is_super_admin");

        if (cancelled) return;
        if (adminError) throw adminError;

        if (isAdmin !== true) {
          setError("Super Admin access required.");
          return;
        }

        setAuthorized(true);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to verify administrator access."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void checkAdmin();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function signOut() {
    setSigningOut(true);
    setError("");

    const { error: signOutError } =
      await supabase.auth.signOut();

    if (signOutError) {
      setError(signOutError.message);
      setSigningOut(false);
      return;
    }

    router.replace("/family-planning/login");
  }

  return (
    <main className="dt-admin">
      <style>{`
        .dt-admin {
          min-height: 100vh;
          background: #f3f7fa;
          color: #172b43;
          font-family: Arial, Helvetica, sans-serif;
          padding: 32px 20px 60px;
          box-sizing: border-box;
        }

        .dt-admin * {
          box-sizing: border-box;
        }

        .dt-container {
          max-width: 1180px;
          margin: 0 auto;
        }

        .dt-header {
          background: linear-gradient(
            120deg,
            #10253e,
            #173b51
          );
          border-radius: 20px;
          padding: 34px 38px;
          color: white;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
          box-shadow: 0 12px 30px rgba(12, 38, 60, 0.12);
        }

        .dt-eyebrow {
          color: #65e0cf;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 1.8px;
          text-transform: uppercase;
          margin: 0 0 14px;
        }

        .dt-heading {
          font-size: 32px;
          font-weight: 750;
          line-height: 1.2;
          margin: 0;
          color: white;
        }

        .dt-subtitle {
          font-size: 15px;
          color: #d0dee7;
          margin: 14px 0 0;
          line-height: 1.6;
        }

        .dt-signout {
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.35);
          border-radius: 9px;
          padding: 11px 20px;
          color: white;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
        }

        .dt-signout:hover {
          background: rgba(255,255,255,0.2);
        }

        .dt-signout:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .dt-section {
          margin-top: 34px;
        }

        .dt-section-heading {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 17px;
        }

        .dt-section-marker {
          width: 5px;
          height: 25px;
          background: #008e85;
          border-radius: 5px;
        }

        .dt-section-title {
          font-size: 20px;
          font-weight: 750;
          color: #183047;
          margin: 0;
        }

        .dt-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
        }

        .dt-card {
          display: flex;
          flex-direction: column;
          min-height: 215px;
          background: white;
          border: 1px solid #e0e8ed;
          border-radius: 16px;
          padding: 25px;
          text-decoration: none;
          color: inherit;
          box-shadow: 0 3px 12px rgba(18, 46, 66, 0.04);
          transition: transform 0.2s ease,
                      box-shadow 0.2s ease,
                      border-color 0.2s ease;
        }

        .dt-card:hover {
          transform: translateY(-3px);
          border-color: #0c9d91;
          box-shadow: 0 10px 26px rgba(18, 46, 66, 0.1);
        }

        .dt-card:focus-visible,
        .dt-signout:focus-visible {
          outline: 3px solid #13b8a6;
          outline-offset: 3px;
        }

        .dt-icon {
          width: 51px;
          height: 51px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #eaf7f5;
          border-radius: 13px;
          font-size: 26px;
          margin-bottom: 20px;
        }

        .dt-card-title {
          font-size: 17px;
          font-weight: 750;
          color: #172e44;
          margin: 0 0 9px;
        }

        .dt-card-description {
          color: #617284;
          font-size: 13px;
          line-height: 1.65;
          margin: 0 0 20px;
        }

        .dt-card-action {
          margin-top: auto;
          color: #007f77;
          font-size: 13px;
          font-weight: 750;
        }

        .dt-notice {
          margin-top: 34px;
          padding: 16px 20px;
          border: 1px solid #dce7ec;
          background: #eaf1f5;
          border-radius: 10px;
          color: #647789;
          font-size: 12px;
          line-height: 1.7;
        }

        .dt-error {
          margin-top: 18px;
          padding: 16px;
          background: #fff0f0;
          color: #a52222;
          border: 1px solid #f0bcbc;
          border-radius: 10px;
          font-size: 14px;
        }

        .dt-state {
          max-width: 650px;
          margin: 80px auto;
          padding: 35px;
          border-radius: 16px;
          background: white;
          border: 1px solid #e0e8ed;
        }

        .dt-state h1 {
          font-size: 24px;
          margin: 0 0 14px;
        }

        .dt-state a {
          color: #007f77;
          font-weight: 700;
        }

        @media (max-width: 900px) {
          .dt-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 600px) {
          .dt-admin {
            padding: 15px 12px 40px;
          }

          .dt-header {
            padding: 25px 22px;
            flex-direction: column;
          }

          .dt-heading {
            font-size: 25px;
          }

          .dt-grid {
            grid-template-columns: 1fr;
          }

          .dt-card {
            min-height: 190px;
          }
        }
      `}</style>

      <div className="dt-container">
        {loading ? (
          <div className="dt-state" role="status">
            Verifying Super Admin access...
          </div>
        ) : !authorized ? (
          <div className="dt-state">
            <h1>DoseTrack Administration</h1>
            <p className="dt-error" role="alert">
              {error || "Access denied."}
            </p>
            <Link href="/family-planning/login">
              Return to Login
            </Link>
          </div>
        ) : (
          <>
            <header className="dt-header">
              <div>
                <p className="dt-eyebrow">
                  DoseTrack / Family Planning
                </p>
                <h1 className="dt-heading">
                  Super Admin Dashboard
                </h1>
                <p className="dt-subtitle">
                  Programme administration, reporting and
                  clinical navigation
                </p>
              </div>

              <button
                type="button"
                className="dt-signout"
                onClick={() => void signOut()}
                disabled={signingOut}
              >
                {signingOut ? "Signing out..." : "Sign Out"}
              </button>
            </header>

            {error && (
              <p className="dt-error" role="alert">
                {error}
              </p>
            )}

            {sections.map((section) => (
              <section
                key={section}
                className="dt-section"
                aria-label={section}
              >
                <div className="dt-section-heading">
                  <span
                    className="dt-section-marker"
                    aria-hidden="true"
                  />
                  <h2 className="dt-section-title">
                    {section}
                  </h2>
                </div>

                <div className="dt-grid">
                  {adminModules
                    .filter(
                      (module) => module.section === section
                    )
                    .map((module) => (
                      <Link
                        key={module.href}
                        href={module.href}
                        className="dt-card"
                      >
                        <div
                          className="dt-icon"
                          aria-hidden="true"
                        >
                          {module.icon}
                        </div>

                        <h3 className="dt-card-title">
                          {module.title}
                        </h3>

                        <p className="dt-card-description">
                          {module.description}
                        </p>

                        <span className="dt-card-action">
                          Open module →
                        </span>
                      </Link>
                    ))}
                </div>
              </section>
            ))}

            <div className="dt-notice">
              Module access remains subject to each destination
              page's authentication and role checks. This
              dashboard does not modify clinical records or
              database permissions.
            </div>
          </>
        )}
      </div>
    </main>
  );
}
