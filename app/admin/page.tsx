"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Module = { title: string; description: string; href: string; icon: string; section: string };

const adminModules: Module[] = [
  { title: "Staff Approvals", description: "Approve and manage healthcare workers", href: "/admin/staff-approvals", icon: "👩‍⚕️", section: "Administration" },
  { title: "Manage Clinics", description: "Manage MHFL, CFS, Demander and clinic details", href: "/admin/clinics", icon: "🏥", section: "Administration" },
  { title: "Assign Clinics", description: "Assign approved staff to healthcare facilities", href: "/admin/assign-clinic", icon: "📋", section: "Administration" },
  { title: "Medication Catalogue", description: "Manage contraceptives and medication records", href: "/admin/medications", icon: "💊", section: "Programme Management" },
  { title: "Reporting & Analytics", description: "Review facility coverage and contraceptive usage", href: "/family-planning/medications/usage", icon: "📊", section: "Programme Management" },
  { title: "Clinical Dashboard", description: "Open patient and clinical workflows", href: "/family-planning/dashboard", icon: "🩺", section: "Clinical Operations" },
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
        const { data, error: authError } = await supabase.auth.getUser();
        if (cancelled) return;
        if (authError || !data.user) {
          router.replace("/family-planning/login");
          return;
        }
        const { data: isAdmin, error: adminError } = await supabase.rpc("dt_is_super_admin");
        if (cancelled) return;
        if (adminError) throw adminError;
        if (isAdmin !== true) {
          setError("Super Admin access required.");
          return;
        }
        setAuthorized(true);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to verify administrator access.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void checkAdmin();
    return () => { cancelled = true; };
  }, [router]);

  async function signOut() {
    setSigningOut(true);
    setError("");
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError(signOutError.message);
      setSigningOut(false);
      return;
    }
    router.replace("/family-planning/login");
  }

  if (loading) {
    return <main className="min-h-screen bg-slate-50 p-8 text-slate-700" role="status">Verifying Super Admin access...</main>;
  }

  if (!authorized) {
    return (
      <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
        <div className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-8">
          <h1 className="text-2xl font-bold">DoseTrack Administration</h1>
          <p role="alert" className="mt-4 text-red-700">{error || "Access denied."}</p>
          <Link href="/family-planning/login" className="mt-5 inline-block font-semibold text-teal-700 underline">Return to Login</Link>
        </div>
      </main>
    );
  }

  const sections = ["Administration", "Programme Management", "Clinical Operations"];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl bg-slate-900 p-6 text-white sm:p-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-teal-300">DoseTrack / Family Planning</p>
            <h1 className="mt-3 text-3xl font-bold">Super Admin Dashboard</h1>
            <p className="mt-2 text-sm text-slate-300">Programme administration, reporting and clinical navigation</p>
          </div>
          <button type="button" onClick={() => void signOut()} disabled={signingOut} className="rounded-lg border border-slate-500 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
            {signingOut ? "Signing out..." : "Sign Out"}
          </button>
        </header>

        {error && <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error}</p>}

        {sections.map((section) => (
          <section key={section} className="mt-9" aria-label={section}>
            <h2 className="mb-4 text-lg font-bold text-slate-800">{section}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {adminModules.filter((module) => module.section === section).map((module) => (
                <Link key={module.href} href={module.href} className="group rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-teal-500 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600">
                  <div aria-hidden="true" className="mb-4 text-3xl">{module.icon}</div>
                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-teal-700">{module.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{module.description}</p>
                  <span className="mt-5 inline-block text-sm font-semibold text-teal-700">Open module →</span>
                </Link>
              ))}
            </div>
          </section>
        ))}

        <p className="mt-10 text-xs leading-5 text-slate-500">Module access remains subject to each destination page's own authentication and role checks. This dashboard does not modify clinical records or database permissions.</p>
      </div>
    </main>
  );
}
