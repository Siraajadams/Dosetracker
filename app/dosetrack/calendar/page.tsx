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
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
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
      end = new Date(start);
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

  function getDates() {
    const range = getRange();
    const dates: string[] = [];
    const start = new Date(range.start);
    const end = new Date(range.end);

    while (start <= end) {
      dates.push(start.toISOString().split("T")[0]);
      start.setDate(start.getDate() + 1);
    }

    return dates;
  }

  async function loadAppointments() {
    setLoading(true);

    const range = getRange();

    let query = supabase
      .from("appointments")
      .select(`
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
      `)
      .gte("appointment_date", range.start)
      .lte("appointment_date", range.end)
      .order("appointment_date")
      .order("appointment_time");

    if (site) query = query.eq("site", site);
    if (doctor) query = query.eq("doctor", doctor);

    const { data, error } = await query;

    if (error) {
      alert("Calendar load failed: " + error.message);
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
      alert("Could not complete appointment: " + error.message);
      return;
    }

    alert("Appointment marked as completed.");
    loadAppointments();
  }

  async function cancelAppointment(appointment: any) {
    const reason = prompt("Reason for cancellation?", "Patient cancelled");

    if (!reason) return;

    const { error } = await supabase
      .from("appointments")
      .update({
        status: "cancelled",
        cancellation_reason: reason,
      })
      .eq("id", appointment.id);

    if (error) {
      alert("Could not cancel appointment: " + error.message);
      return;
    }

    alert("Appointment cancelled.");
    loadAppointments();
  }

  async function rescheduleAppointment(appointment: any) {
    const newDate = prompt(
      "Enter new appointment date in YYYY-MM-DD format:",
      appointment.appointment_date
    );

    if (!newDate) return;

    const newTime = prompt(
      "Enter new appointment time, example 14:00:",
      String(appointment.appointment_time).slice(0, 5)
    );

    if (!newTime) return;

    const { error } = await supabase
      .from("appointments")
      .update({
        appointment_date: newDate,
        appointment_time: newTime,
        rescheduled_from_date: appointment.appointment_date,
        rescheduled_from_time: String(appointment.appointment_time).slice(0, 5),
        status: "scheduled",
      })
      .eq("id", appointment.id);

    if (error) {
      alert("Could not reschedule appointment: " + error.message);
      return;
    }

    alert("Appointment rescheduled.");
    setSelectedDate(newDate);
    loadAppointments();
  }

  function getAppointment(date: string, time: string) {
    return appointments.find(
      (a) =>
        a.appointment_date === date &&
        String(a.appointment_time).slice(0, 5) === time &&
        a.status !== "completed" &&
        a.status !== "cancelled"
    );
  }

  const dates = getDates();

  return (
    <main style={pageStyle}>
      <Link href="/dosetrack">
        <button style={backButton}>← Back to Dashboard</button>
      </Link>

      <section style={heroStyle}>
        <h1 style={{ margin: 0 }}>Injection Calendar</h1>
        <p>
          Manage weekly GLP-1 injection appointments, cancellations and rescheduling.
        </p>
      </section>

      <section style={cardStyle}>
        <h3>Reception workflow</h3>
        <p>
          Select view and date. Open the patient profile when the patient arrives.
          Mark completed after dose is given, or cancel/reschedule if the patient changes time.
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <select style={inputStyle} value={view} onChange={(e) => setView(e.target.value)}>
            <option value="day">Day View</option>
            <option value="week">Week View</option>
            <option value="month">Month View</option>
          </select>

          <input
            style={inputStyle}
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />

          <select style={inputStyle} value={site} onChange={(e) => setSite(e.target.value)}>
            <option value="">All Sites</option>
            {sites.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>

          <select style={inputStyle} value={doctor} onChange={(e) => setDoctor(e.target.value)}>
            <option value="">All Doctors</option>
            {doctors.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>

          <button style={primaryButton} onClick={loadAppointments}>
            Refresh
          </button>
        </div>
      </section>

      {loading && <p>Loading calendar...</p>}

      <section style={calendarCard}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            minWidth: view === "day" ? 760 : 1200,
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
                        <div style={appointmentCard}>
                          <strong>
                            {appointment.patients?.first_name}{" "}
                            {appointment.patients?.surname}
                          </strong>

                          <p style={{ margin: "6px 0" }}>
                            Dose: {appointment.patients?.current_dose}
                          </p>

                          <p style={{ margin: "6px 0" }}>
                            Site: {appointment.site || "Not set"}
                          </p>

                          <p style={{ margin: "6px 0" }}>
                            Doctor: {appointment.doctor || "Not set"}
                          </p>

                          <p style={{ margin: "6px 0" }}>
                            Status: {appointment.status}
                          </p>

                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <Link href={`/dosetrack/patient/${appointment.patient_id}`}>
                              <button style={smallButton}>Open</button>
                            </Link>

                            <button
                              onClick={() => markCompleted(appointment)}
                              style={{ ...smallButton, background: "#16a34a" }}
                            >
                              Complete
                            </button>

                            <button
                              onClick={() => rescheduleAppointment(appointment)}
                              style={{ ...smallButton, background: "#f59e0b" }}
                            >
                              Reschedule
                            </button>

                            <button
                              onClick={() => cancelAppointment(appointment)}
                              style={{ ...smallButton, background: "#dc2626" }}
                            >
                              Cancel
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

const pageStyle = {
  minHeight: "100vh",
  padding: 24,
  background: "linear-gradient(135deg, #eef7ff, #f8fafc)",
  fontFamily: "Arial, sans-serif",
};

const heroStyle = {
  background: "linear-gradient(135deg, #0f766e, #2563eb)",
  color: "white",
  padding: 26,
  borderRadius: 18,
  marginBottom: 20,
};

const cardStyle = {
  background: "white",
  padding: 18,
  borderRadius: 14,
  marginBottom: 20,
  boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
};

const calendarCard = {
  overflowX: "auto" as const,
  background: "white",
  borderRadius: 14,
  padding: 16,
  boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
};

const inputStyle = {
  padding: 10,
  borderRadius: 8,
  border: "1px solid #cbd5e1",
};

const backButton = {
  padding: 10,
  borderRadius: 8,
  marginBottom: 20,
  border: "1px solid #cbd5e1",
  background: "white",
};

const primaryButton = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "none",
  background: "#2563eb",
  color: "white",
  cursor: "pointer",
};

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

const appointmentCard = {
  padding: 10,
  borderRadius: 10,
  background: "#e0f2fe",
  borderLeft: "5px solid #2563eb",
};

const smallButton = {
  padding: "6px 10px",
  borderRadius: 6,
  border: "none",
  background: "#2563eb",
  color: "white",
  cursor: "pointer",
};
