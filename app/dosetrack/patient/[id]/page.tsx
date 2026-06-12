"use client";

import Link from "next/link";

export default function DoseTrackDashboard() {
  return (
    <main style={{ padding: 24 }}>
      <h1>DoseTrack Calendar</h1>

      <p>Multi-site weekly injection scheduling and dose tracker.</p>

      <div style={{ marginTop: 20 }}>
        <Link href="/dosetrack/add-patient">
          <button style={{ padding: 12 }}>Add New Patient</button>
        </Link>
      </div>

      <section style={{ marginTop: 30 }}>
        <h2>Dashboard</h2>

        <div style={{ display: "grid", gap: 12, maxWidth: 500 }}>
          <div style={{ border: "1px solid #ddd", padding: 16 }}>
            <strong>Patient ID / ID Number</strong>
            <p>Track clinic patient ID, SA ID number, or passport number.</p>
          </div>

          <div style={{ border: "1px solid #ddd", padding: 16 }}>
            <strong>Today's Injections</strong>
            <p>View scheduled weekly injections.</p>
          </div>

          <div style={{ border: "1px solid #ddd", padding: 16 }}>
            <strong>Patients</strong>
            <p>Track patient ID, ID number, doctor, site and dose plan.</p>
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
