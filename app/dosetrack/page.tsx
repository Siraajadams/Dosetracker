"use client";

import Link from "next/link";

export default function DoseTrackDashboard() {
  return (
    <main style={{ padding: 24 }}>
      <h1>DoseTrack Calendar</h1>

      <p>Multi-site weekly injection scheduling and dose tracker.</p>

      <div style={{ marginTop: 20 }}>
        <Link href="/dosetrack/add-patient">
          <button style={{ padding: 12 }}>
            Add New Patient
          </button>
        </Link>
      </div>

      <section style={{ marginTop: 30 }}>
        <h2>Dashboard</h2>

        <div style={{ display: "grid", gap: 12, maxWidth: 500 }}>
          <div style
