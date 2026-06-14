"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function DoseTrackDashboard() {
  const [search, setSearch] = useState("");
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [stats, setStats] = useState({
    totalPatients: 0,
    todaysInjections: 0,
    overdueAppointments: 0,
    pendingApprovals: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    const today = new Date().toISOString().split("T")[0];

    const { count: totalPatients } = await supabase
      .from("patients")
      .select("*", { count: "exact", head: true });

    const { count: todaysInjections } = await supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("appointment_date", today)
      .eq("status", "scheduled");

    const { count: overdueAppointments } = await supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .lt("appointment_date", today)
      .eq("status", "scheduled");

    const { count: pendingApprovals } = await supabase
      .from("dose_changes")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    setStats({
      totalPatients: totalPatients || 0,
      todaysInjections: todaysInjections || 0,
      overdueAppointments: overdueAppointments || 0,
      pendingApprovals: pendingApprovals || 0,
    });
  }

  async function findPatient() {
    if (!search) {
      alert("Enter name, ID, mobile or clinic ID.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .or(
        `first_name.ilike.%${search}%,surname.ilike.%${search}%,id_number.ilike.%${search}%,mobile_number.ilike.%${search}%,patient_clinic_id.ilike.%${search}%`
      )
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setPatients(data || []);
    setLoading(false);
  }

  const cardStyle = {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 20,
    boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
  };

  const dashboardCards = [
    ["Patients", `${stats.totalPatients} active patients`],
    ["Today’s Injections", `${stats.todaysInjections} scheduled today`],
    ["Missed Appointments", `${stats.overdueAppointments} overdue`],
    ["Pen/Vial Tracker", "Track dose 1–6 per pen"],
    ["Doctor Approvals", `${stats.pendingApprovals} pending approvals`],
  ];

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 24,
        background: "linear-gradient(135deg, #eef7ff, #f8fafc)",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <section
        style={{
          background: "linear-gradient(135deg, #0f766e, #2563eb)",
          color: "white",
          padding: 28,
          borderRadius: 18,
          marginBottom: 28,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 34 }}>DoseTrack Calendar</h1>
        <p>Multi-site weekly injection scheduling and GLP-1 dose tracker.</p>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href="/dosetrack/add-patient">
            <button style={{ padding: 12, borderRadius: 10, border: "none" }}>
              Add New Patient
            </button>
          </Link>

          <Link href="/dosetrack/calendar">
            <button style={{ padding: 12, borderRadius: 10, border: "none" }}>
              Injection Calendar
            </button>
          </Link>
        </div>
      </section>

      <section style={cardStyle}>
        <h2>Find Existing Patient</h2>
        <p>Use this when a patient arrives early, late or without checking the calendar.</p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            placeholder="Search name, ID, mobile or clinic ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: 14,
              minWidth: 320,
              borderRadius: 10,
              border: "1px solid #cbd5e1",
            }}
          />

          <button
            onClick={findPatient}
            style={{
              padding: 14,
              borderRadius: 10,
              border: "none",
              background: "#2563eb",
              color: "white",
            }}
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </div>

        <div style={{ display: "grid", gap: 12, marginTop: 20 }}>
          {patients.map((patient) => (
            <div key={patient.id} style={cardStyle}>
              <strong>
                {patient.first_name} {patient.surname}
              </strong>

              <p>ID / Passport: {patient.id_number}</p>
              <p>Mobile: {patient.mobile_number}</p>
              <p>Doctor: {patient.doctor}</p>
              <p>Site: {patient.clinic_site}</p>
              <p>Dose: {patient.current_dose}</p>

              <Link href={`/dosetrack/patient/${patient.id}`}>
                <button
                  style={{
                    padding: 10,
                    borderRadius: 8,
                    border: "none",
                    background: "#0f766e",
                    color: "white",
                  }}
                >
                  Open Patient Profile
                </button>
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 28 }}>
        <h2>Dashboard</h2>

        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          {dashboardCards.map(([title, text]) => (
            <div key={title} style={cardStyle}>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
