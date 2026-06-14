"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

const sites = [
  "Authentic Aesthetics",
  "Palmyra Pharmacy",
  "Medirite Langverwacht",
  "Medirite St Johns",
  "Medirite Dasport",
  "Medirite Olivedale",
];

const doctors = [
  "Dr Khumalo",
  "Dr Jemma Salvage",
  "Dr Chika",
  "Dr Yusra Khan",
  "Dr Ayesha Cassiem",
];

const slots = Array.from({ length: 37 }, (_, i) => {
  const total = 9 * 60 + i * 15;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

export default function InjectionCalendarPage() {
  const [view, setView] = useState("day");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [site, setSite] = useState("");
  const [doctor, setDoctor] = useState("");
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAppointments();
  }, [selectedDate, site, doctor, view]);

  function getRange() {
    const date = new Date(selectedDate);
    let start = new Date(date);
    let end = new Date(date);

    if (view === "week") {
      const day = date.getDay();
      start.setDate(date.getDate() - day);
      end.setDate(start.getDate() + 6);
    }

    if (view === "month") {
      start = new Date(date.getFullYear(), date.getMonth(), 1);
      end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    }

    return {
      start: start.toISOString().split("T")[0],
      end: end.toISOString().split("T")[0],
    };
  }

  async function loadAppointments() {
    setLoading(true);

    const range = getRange();

    let query = supabase
      .from("appointments")
      .select(
        `
        *,
        patients (
          id,
          first_name,
          surname,
          mobile_number,
          current_dose,
          medication,
          patient_clinic_id
        )
      `
      )
      .gte("appointment_date", range.start)
      .lte("appointment_date", range.end)
      .order("appointment_date")
      .order("appointment_time");

    if (site) query = query.eq("site", site);
    if (doctor) query = query.eq("doctor", doctor);

    const { data, error } = await query;

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setAppointments(data || []);
    setLoading(false);
  }

  async function markCompleted(appointment: any) {
    const { error } = await supabase
      .from("appointments")
      .update({ status: "completed" })
      .eq("id", appointment.id);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Appointment marked as completed.");
    loadAppointments();
  }

  function getAppointment(date: string, time: string) {
    return appointments.find(
      (a) =>
        a.appointment_date === date &&
        String(a.appointment_time).slice(0, 5) === time &&
        a.status !== "completed"
    );
  }

  function getDates() {
    const range = getRange();
    const dates = [];
    const start = new Date(range.start);
    const end = new Date(range.end);

    while (start <= end) {
      dates.push(start.toISOString().split("T")[0]);
      start.setDate(start.getDate() + 1);
    }

    return dates;
  }

  const dates = getDates();

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
          padding: 26,
          borderRadius: 18,
          marginBottom: 20,
        }}
      >
        <h1 style={{ margin: 0 }}>Injection Calendar</h1>
        <p>
          Reception calendar for weekly GLP-1 injections. Each slot is 15
          minutes from 09:00 to 18:00.
        </p>
      </section>

      <section
        style={{
          background: "white",
          padding: 18,
          borderRadius: 14,
          marginBottom: 20,
          boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
        }}
      >
        <h3>Next steps for reception</h3>
        <p>
          1. Select the day, week or month. 2. Filter by site or doctor. 3. Open
          the patient profile or mark the appointment completed after the dose is
          given.
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <select value={view} onChange={(e) => setView(e.target.value)}>
            <option value="day">Day View</option>
            <option value="week">Week View</option>
            <option value="month">Month View</option>
          </select>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />

          <select value={site} onChange={(e) => setSite(e.target.value)}>
            <option value="">All Sites</option>
            {sites.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>

          <select value={doctor} onChange={(e) => setDoctor(e.target.value)}>
            <option value="">All Doctors</option>
            {doctors.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>

          <button onClick={loadAppointments}>Refresh</button>
        </div>
      </section>

      {loading && <p>Loading calendar...</p>}

      <section
        style={{
          overflowX: "auto",
          background: "white",
          borderRadius: 14,
          padding: 16,
          boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            minWidth: view === "day" ? 700 : 1100,
          }}
        >
          <thead>
            <tr>
              <th style={thStyle}>Time</th>
              {dates.map((date) => (
                <th key={date} style={thStyle}>
                  {date}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {slots.map((time) => (
              <tr key={time}>
                <td style={tdStyle}>
                  <strong>{time}</strong>
                </td>

                {dates.map((date) => {
                  const appointment = getAppointment(date, time);

                  return (
                    <td key={`${date}-${time}`} style={tdStyle}>
                      {appointment ? (
                        <div
                          style={{
                            padding: 10,
                            borderRadius: 10,
                            background: "#e0f2fe",
                            borderLeft: "5px solid #2563eb",
                          }}
                        >
                          <strong>
                            {appointment.patients?.first_name}{" "}
                            {appointment.patients?.surname}
                          </strong>

                          <p style={{ margin: "6px 0" }}>
                            {appointment.patients?.current_dose} |{" "}
                            {appointment.site}
                          </p>

                          <p style={{ margin: "6px 0" }}>
                            {appointment.doctor}
                          </p>

                          <div
                            style={{
                              display: "flex",
                              gap: 6,
                              flexWrap: "wrap",
                            }}
                          >
                            <Link
                              href={`/dosetrack/patient/${appointment.patient_id}`}
                            >
                              <button style={smallButton}>Open</button>
                            </Link>

                            <button
                              onClick={() => markCompleted(appointment)}
                              style={{
                                ...smallButton,
                                background: "#16a34a",
                                color: "white",
                              }}
                            >
                              Mark Completed
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>Available</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

const thStyle = {
  border: "1px solid #e5e7eb",
  padding: 12,
  background: "#f1f5f9",
  textAlign: "left" as const,
};

const tdStyle = {
  border: "1px solid #e5e7eb",
  padding: 10,
  verticalAlign: "top" as const,
};

const smallButton = {
  padding: "6px 10px",
  borderRadius: 6,
  border: "none",
  background: "#2563eb",
  color: "white",
  cursor: "pointer",
};
