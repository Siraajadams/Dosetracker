
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const reports = [
  {
    title: "Contraceptive Usage",
    icon: "💉",
    description:
      "Review contraceptive administrations by medication, month, year and facility.",
    href: "/family-planning/medications/usage",
  },
  {
    title: "Patient Reports",
    icon: "👥",
    description:
      "Review patient registrations and clinical records.",
    href: "/family-planning/patients",
  },
  {
    title: "Inventory Reports",
    icon: "📦",
    description:
      "Review stock balances, consumption and reorder activity.",
    href: "/family-planning/inventory",
  },
];

export default function ClinicalReportsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [authorised, setAuthorised] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function checkAccess() {
      try {
        const { data, error } = await supabase.auth.getUser();

        if (cancelled) return;

        if (error || !data.user) {
          router.replace("/family-planning/login");
          return;
        }

        const result = await supabase.rpc("dt_is_super_admin");

        if (cancelled) return;

        if (result.error) {
          setMessage("Unable to verify administrator access.");
          return;
        }

        if (result.data !== true) {
          setMessage(
            "Clinical Reports requires administrator access."
          );
          return;
        }

        setAuthorised(true);
      } catch {
        if (!cancelled) {
          setMessage("Unable to verify your permissions.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void checkAccess();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (loading) {
    return (
      <main style={styles.page}>
        <p>Checking Clinical Reports permissions...</p>
      </main>
    );
  }

  if (!authorised) {
    return (
      <main style={styles.page}>
        <section style={styles.panel}>
          <h1>Access restricted</h1>
          <p>{message}</p>
          <Link href="/family-planning/dashboard">
            Return to dashboard
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <Link
          href="/family-planning/dashboard"
          style={styles.back}
        >
          ← Back to dashboard
        </Link>

        <header style={styles.header}>
          <span style={styles.eyebrow}>
            DOSETRACK / FAMILY PLANNING
          </span>

          <h1 style={styles.heading}>Clinical Reports</h1>

          <p style={styles.subtitle}>
            Access patient, contraceptive medication and
            inventory reporting workspaces.
          </p>
        </header>

        <div style={styles.grid}>
          {reports.map((report) => (
            <Link
              key={report.href}
              href={report.href}
              style={styles.card}
            >
              <span style={styles.icon}>
                {report.icon}
              </span>

              <h2 style={styles.cardTitle}>
                {report.title}
              </h2>

              <p style={styles.description}>
                {report.description}
              </p>

              <span style={styles.action}>
                Open report →
              </span>
            </Link>
          ))}
        </div>

        <section style={styles.info}>
          <h2>Reporting workspace</h2>
          <p>
            This page provides navigation to existing DoseTrack
            reporting modules. Consolidated facility reports,
            stock summaries and CSV exports can be added once
            their Supabase data sources and access policies
            are confirmed.
          </p>
        </section>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f5f8fa",
    color: "#172d36",
    padding: "28px 18px",
    fontFamily: "Arial, sans-serif",
  },
  container: {
    maxWidth: 1100,
    margin: "0 auto",
  },
  back: {
    display: "inline-block",
    color: "#0e756d",
    fontWeight: 700,
    textDecoration: "none",
    marginBottom: 24,
  },
  header: {
    padding: "30px 0",
  },
  eyebrow: {
    color: "#648087",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 1.5,
  },
  heading: {
    fontSize: 34,
    marginBottom: 12,
  },
  subtitle: {
    color: "#647781",
    lineHeight: 1.7,
  },
  grid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
    gap: 18,
  },
  card: {
    display: "flex",
    flexDirection: "column",
    background: "#fff",
    border: "1px solid #e3eaf0",
    borderRadius: 18,
    padding: 25,
    textDecoration: "none",
    color: "#172d36",
    minHeight: 245,
  },
  icon: {
    fontSize: 30,
  },
  cardTitle: {
    fontSize: 19,
    marginTop: 20,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    lineHeight: 1.7,
    color: "#647781",
    flex: 1,
  },
  action: {
    display: "block",
    color: "#0e756d",
    fontWeight: 800,
    borderTop: "1px solid #e3eaf0",
    paddingTop: 16,
    marginTop: 20,
  },
  panel: {
    background: "#fff",
    borderRadius: 16,
    padding: 30,
    maxWidth: 600,
    margin: "40px auto",
  },
  info: {
    background: "#fff",
    border: "1px solid #e3eaf0",
    borderRadius: 16,
    padding: 25,
    marginTop: 30,
    lineHeight: 1.7,
    color: "#647781",
  },
};
