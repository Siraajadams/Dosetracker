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

  useEffect(() => {
    loadReports();
  }, [month]);

  async function loadReports() {
    setLoading(true);

    const startDate = `${month}-01`;
    const endDate = new Date(
      Number(month.split("-")[0]),
      Number(month.split("-")[1]),
      0
    )
      .toISOString()
      .split("T")[0];

    const { data: patientsData } = await supabase
      .from("patients")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: injectionsData } = await supabase
      .from("injections")
      .select("*")
      .gte("injection_date", startDate)
      .lte("injection_date", endDate);

    const { data: appointmentsData } = await supabase
      .from("appointments")
      .select("*, patients(*)")
      .gte("appointment_date", startDate)
      .lte("appointment_date", endDate);

    setPatients(patientsData || []);
    setInjections(injectionsData || []);
    setAppointments(appointmentsData || []);
    setLoading(false);
  }

  function groupCount(field: string) {
    const result: Record<string, number> = {};

    patients.forEach((p) => {
      const key = p[field] || "Not captured";
      result[key] = (result[key] || 0) + 1;
    });

    return Object.entries(result);
  }

  function averageWeightLoss() {
    const valid = patients.filter((p) => Number(p.weight_lost) > 0);

    if (valid.length === 0) return 0;

    const total = valid.reduce(
      (sum, p) => sum + Number(p.weight_lost || 0),
      0
    );

    return Number((total / valid.length).toFixed(1));
  }

  const completedAppointments = appointments.filter(
    (a) => a.status === "completed"
  );

  const scheduledAppointments = appointments.filter(
    (a) => a.status === "scheduled"
  );

  const missedAppointments = appointments.filter(
    (a) => a.status === "missed"
  );

  const pensOpened = patients.reduce(
    (sum, p) => sum + Number(p.pen_number || 1),
    0
  );

  const pensCompleted = injections.filter(
    (i) => Number(i.dose_number) === 6
  ).length;

  const cardStyle = {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 20,
    boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
  };

  const tableStyle = {
    width: "100%",
    borderCollapse: "collapse" as const,
    marginTop: 12,
  };

  const cellStyle = {
    borderBottom: "1px solid #e5e7eb",
    padding: 10,
    textAlign: "left" as const,
  };

  function printReport() {
    window.print();
  }

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
        <button style={{ marginBottom: 20 }}>← Back to Dashboard</button>
      </Link>

      <section
        style={{
          background: "linear-gradient(135deg, #0f766e, #2563eb)",
          color: "white",
          padding: 28,
          borderRadius: 18,
          marginBottom: 28,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 34 }}>Monthly Reports</h1>
        <p>
          DoseTrack operational report for injections, weight loss, doctors,
          sites and pen utilisation.
        </p>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            style={{
              padding: 12,
              borderRadius: 10,
              border: "none",
            }}
          />

          <button
            onClick={loadReports}
            style={{
              padding: 12,
              borderRadius: 10,
              border: "none",
            }}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>

          <button
            onClick={printReport}
            style={{
              padding: 12,
              borderRadius: 10,
              border: "none",
            }}
          >
            Print / Save PDF
          </button>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          marginBottom: 28,
        }}
      >
        <div style={cardStyle}>
          <h3>Total Patients</h3>
          <h1>{patients.length}</h1>
        </div>

        <div style={cardStyle}>
          <h3>Injections Recorded</h3>
          <h1>{injections.length}</h1>
        </div>

        <div style={cardStyle}>
          <h3>Average Weight Loss</h3>
          <h1>{averageWeightLoss()} kg</h1>
        </div>

        <div style={cardStyle}>
          <h3>Scheduled Appointments</h3>
          <h1>{scheduledAppointments.length}</h1>
        </div>

        <div style={cardStyle}>
          <h3>Completed Appointments</h3>
          <h1>{completedAppointments.length}</h1>
        </div>

        <div style={cardStyle}>
          <h3>Missed Appointments</h3>
          <h1>{missedAppointments.length}</h1>
        </div>

        <div style={cardStyle}>
          <h3>Pens Opened</h3>
          <h1>{pensOpened}</h1>
        </div>

        <div style={cardStyle}>
          <h3>Pens Completed</h3>
          <h1>{pensCompleted}</h1>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gap: 20,
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        }}
      >
        <div style={cardStyle}>
          <h2>Patients by Dose</h2>
          <table style={tableStyle}>
            <tbody>
              {groupCount("current_dose").map(([dose, count]) => (
                <tr key={dose}>
                  <td style={cellStyle}>{dose}</td>
                  <td style={cellStyle}>{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={cardStyle}>
          <h2>Patients by Doctor</h2>
          <table style={tableStyle}>
            <tbody>
              {groupCount("doctor").map(([doctor, count]) => (
                <tr key={doctor}>
                  <td style={cellStyle}>{doctor}</td>
                  <td style={cellStyle}>{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={cardStyle}>
          <h2>Patients by Site</h2>
          <table style={tableStyle}>
            <tbody>
              {groupCount("clinic_site").map(([site, count]) => (
                <tr key={site}>
                  <td style={cellStyle}>{site}</td>
                  <td style={cellStyle}>{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={cardStyle}>
          <h2>Pen Utilisation</h2>
          <table style={tableStyle}>
            <tbody>
              {patients.map((patient) => (
                <tr key={patient.id}>
                  <td style={cellStyle}>
                    {patient.first_name} {patient.surname}
                  </td>
                  <td style={cellStyle}>Pen {patient.pen_number || 1}</td>
                  <td style={cellStyle}>Dose {patient.dose_number || 1} of 6</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ ...cardStyle, marginTop: 28 }}>
        <h2>Weight Loss Summary</h2>

        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={cellStyle}>Patient</th>
              <th style={cellStyle}>Starting Weight</th>
              <th style={cellStyle}>Current Weight</th>
              <th style={cellStyle}>Weight Lost</th>
              <th style={cellStyle}>BMI</th>
            </tr>
          </thead>

          <tbody>
            {patients.map((patient) => (
              <tr key={patient.id}>
                <td style={cellStyle}>
                  {patient.first_name} {patient.surname}
                </td>
                <td style={cellStyle}>{patient.starting_weight || "-"} kg</td>
                <td style={cellStyle}>{patient.current_weight || "-"} kg</td>
                <td style={cellStyle}>{patient.weight_lost || 0} kg</td>
                <td style={cellStyle}>{patient.bmi || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
