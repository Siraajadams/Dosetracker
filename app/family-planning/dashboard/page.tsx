
"use client";

import { useEffect, useState } from "react";
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
        .eq("active", true)
        .limit(1);

      if (cancelled) return;

      if (result.error) {
        setMessage("Unable to verify Family Planning permissions.");
      } else if (!result.data || result.data.length === 0) {
        setMessage("Your account is awaiting administrator approval.");
      } else {
        const approved = result.data[0];

        if (
          ["super_admin", "administrator", "nurse", "doctor"]
            .includes(approved.role)
        ) {
          setMembership(approved);
        } else {
          setMessage("Your account does not have clinical access.");
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

  return (
    <main
      style={{
        padding: 32,
        fontFamily: "Arial, sans-serif",
        background: "#f0fdfa",
        minHeight: "100vh",
      }}
    >
      <h1 style={{ color: "#0f766e" }}>
        DoseTrack Family Planning
      </h1>

      <p>Family Planning Management Dashboard</p>

      {!membership ? (
        <section
          style={{
            background: "white",
            padding: 24,
            borderRadius: 16,
            maxWidth: 650,
          }}
        >
          <h2>Clinical access not yet enabled</h2>
          <p>{message}</p>
        </section>
      ) : (
        <section
          style={{
            background: "white",
            padding: 24,
            borderRadius: 16,
            maxWidth: 650,
          }}
        >
          <h2>Welcome to Family Planning</h2>
          <p>
            Access approved. Your role is{" "}
            <strong>{membership.role}</strong>.
          </p>
          <p>Facility ID: {membership.facility_id}</p>

          <h3>Dashboard modules</h3>
          <ul>
            <li>Patient registration — coming soon</li>
            <li>Contraceptive administration — coming soon</li>
            <li>Follow-up appointments — coming soon</li>
            <li>Inventory management — coming soon</li>
            <li>Clinical reports — coming soon</li>
            {membership.role === "super_admin" && (
              <li>Staff administration — coming soon</li>
            )}
          </ul>
        </section>
      )}
    </main>
  );
}
