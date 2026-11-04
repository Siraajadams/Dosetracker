
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function FamilyPlanningDashboard() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkSession() {
      const { data, error } = await supabase.auth.getUser();

      if (error || !data.user) {
        router.replace("/family-planning/login");
        return;
      }

      // Authentication alone is not clinical authorisation.
      // Do not display patient data until membership,
      // approval and facility access have been verified.
      setChecking(false);
    }

    checkSession();
  }, [router]);

  if (checking) {
    return <main style={{ padding: 32 }}>
      Checking your session...
    </main>;
  }

  return (
    <main style={{
      padding: 32,
      fontFamily: "Arial, sans-serif",
      background: "#f0fdfa",
      minHeight: "100vh"
    }}>
      <h1 style={{ color: "#0f766e" }}>
        DoseTrack Family Planning
      </h1>

      <p>Dashboard setup in progress</p>

      <section style={{
        background: "white",
        padding: 24,
        borderRadius: 16,
        maxWidth: 650
      }}>
        <h2>Clinical access not yet enabled</h2>
        <p>
          Your session is active. Family Planning
          permissions must be verified before
          patient records and clinical modules
          can be accessed.
        </p>
      </section>
    </main>
  );
}
