"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function DoseTrackDashboard() {
  const [search, setSearch] = useState("");
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function findPatient() {
    if (!search) {
      alert("Enter patient name, surname, ID number, mobile number or clinic ID.");
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

  return (
    <main style={{ padding: 24 }}>
      <h1>DoseTrack Calendar</h1>

      <p>Multi-site weekly injection scheduling and dose tracker.</p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 20 }}>
        <Link href="/dosetrack/add-patient">
          <button style={{ padding: 12 }}>Add New Patient</button>
        </Link>

        <Link href="/dosetrack/calendar">
          <button style={{ padding: 12 }}>Injection Calendar</button>
        </Link>
      </div>

      <section style={{ marginTop: 30, maxWidth: 800 }}>
        <h2>Find Existing Patient</h2>

        <p>
          Use this when a patient arrives early, late or without checking the calendar.
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            placeholder="Search name, ID, mobile or clinic ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: 12, minWidth: 320 }}
          />

          <button onClick={findPatient} style={{ padding: 12 }}>
            {loading ? "Searching..." : "Search"}
          </button>
        </div>

        <div style={{ display: "grid", gap: 12, marginTop: 20 }}>
          {patients.map((patient) => (
            <div
              key={patient.id}
              style={{
                border: "1px solid #ddd",
                padding: 16,
                borderRadius: 6,
              }}
            >
              <strong>
                {patient.first_name} {patient.surname}
              </strong>

              <p>ID / Passport: {patient.id_number}</p>
              <p>Mobile: {patient.mobile_number}</p>
              <p>Doctor: {patient.doctor}</p>
              <p>Site: {patient.clinic_site}</p>
              <p>Dose: {patient.current_dose}</p>

              <Link href={`/dosetrack/patient/${patient.id}`}>
                <button style={{ padding: 10 }}>
                  Open Patient Profile
                </button>
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 30 }}>
        <h2>Dashboard</h2>

        <div style={{ display: "grid", gap: 12, maxWidth: 500 }}>
          <div style={{ border: "1px solid #ddd", padding: 16 }}>
            <strong>Patient ID / ID Number</strong>
            <p>Track clinic patient ID, SA ID number, or passport number.</p>
          </div>

          <div style={{ border: "1px solid #ddd", padding: 16 }}>
            <strong>Today&apos;s Injections</strong>
            <p>View scheduled weekly injections.</p>
          </div>

          <div style={{ border: "1px solid #ddd", padding: 16 }}>
            <strong>Patients</strong>
            <p>Find patients who arrive early, late or unscheduled.</p>
          </div>

          <div style={{ border: "1px solid #ddd", padding: 16 }}>
            <strong>Pen/Vial Tracker</strong>
            <p>Track dose 1–6 for each assigned pen or vial.</p>
          </div>

          <div style={{ border: "1px solid #ddd", padding: 16 }}>
            <strong>Doctor Approvals</strong>
            <p>Flag dose increases requiring approval.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
