"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function ReportsPage() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(false);

  const [patients, setPatients] = useState<any[]>([]);
  const [injections, setInjections] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [doseChanges, setDoseChanges] = useState<any[]>([]);

  useEffect(() => {
    loadReport();
  }, [month]);

  async function loadReport() {
    setLoading(true);

    const start = `${month}-01`;
    const endDate = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0);
    const end = endDate.toISOString().split("T")[0];

    const { data: patientsData } = await supabase.from("patients").select("*");

    const { data: injectionsData } = await supabase
      .from("injections")
      .select("*, patients(*)")
      .gte("injection_date", start)
      .lte("injection_date", end);

    const { data: appointmentsData } = await supabase
      .from("appointments")
      .select("*, patients(*)")
      .gte("appointment_date", start)
      .lte("appointment_date", end);

    const { data: doseChangesData } = await supabase
      .from("dose_changes")
      .select("*, patients(*)")
      .gte("created_at", start)
      .lte("created_at", end);

    setPatients(patientsData || []);
    setInjections(injectionsData || []);
    setAppointments(appointmentsData || []);
    setDoseChanges(doseChangesData || []);
    setLoading(false);
  }

  function countBy(items: any[], field: string) {
    const result: Record<string, number> = {};

    items.forEach((item) => {
      const key = item[field] || item.patients?.[field] || "Unknown";
      result[key] = (result[key] || 0) + 1;
    });

    return result;
  }

  const completedAppointments = appointments.filter((a) => a.status === "completed");
  const scheduledAppointments = appointments.filter((a) => a.status === "scheduled");
  const missedAppointments = appointments.filter((a) => {
    const today = new Date().toISOString().split("T")[0];
    return a.status === "scheduled" && a.appointment_date < today;
  });

  const injectionsBySite = countBy(appointments, "site");
  const injectionsByDoctor = countBy(appointments, "doctor");
  const injectionsByDose = countBy(injections, "dose_given");
  const penDoseUsage = countBy(injections, "pen_dose_number");

  const cardStyle = {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 18,
    boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 24,
        background: "linear-gradient(135deg, #eef7ff, #f8fafc)",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <Link href="/dosetrack">
        <button style={{ padding: 10, borderRadius: 8, marginBottom: 20 }}>
          ← Back to Dashboard
        </button>
      </Link>

      <section
        style={{
          background: "linear-gradient(135deg, #0f766e, #2563eb)",
          color: "white",
          padding: 28,
          borderRadius: 18,
          marginBottom: 24,
        }}
      >
        <h1 style={{ margin: 0 }}>Monthly Reports</h1>
        <p>DoseTrack operational report for injections, sites, doctors and missed appointments.</p>

        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          style={{
            padding: 12,
            borderRadius: 10,
            border: "none",
            marginTop: 10,
          }}
        />
      </section>

      {loading && <p>Loading report...</p>}

      <section
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          marginBottom: 28,
        }}
      >
        {[
          ["Total Patients", patients.length],
          ["Injections Recorded", injections.length],
          ["Completed Appointments", completedAppointments.length],
          ["Scheduled Appointments", scheduledAppointments.length],
          ["Missed Appointments", missedAppointments.length],
          ["Dose Changes", doseChanges.length],
        ].map(([title, value]) => (
          <div key={title} style={cardStyle}>
            <h3>{title}</h3>
            <p style={{ fontSize: 28, fontWeight: "bold" }}>{value}</p>
          </div>
        ))}
      </section>

      <section style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        <ReportTable title="Injections by Clinic Site" data={injectionsBySite} />
        <ReportTable title="Injections by Doctor" data={injectionsByDoctor} />
        <ReportTable title="Injections by Dose" data={injectionsByDose} />
        <ReportTable title="Pen Dose Usage 1–6" data={penDoseUsage} />
      </section>
    </main>
  );
}

function ReportTable({ title, data }: { title: string; data: Record<string, number> }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        padding: 18,
        boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
      }}
    >
      <h2>{title}</h2>

      {Object.keys(data).length === 0 ? (
        <p>No data for this month.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {Object.entries(data).map(([label, count]) => (
              <tr key={label}>
                <td style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>
                  {label}
                </td>
                <td
                  style={{
                    padding: 10,
                    borderBottom: "1px solid #e5e7eb",
                    textAlign: "right",
                    fontWeight: "bold",
                  }}
                >
                  {count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
