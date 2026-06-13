"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

const sites = [
  "All Sites",
  "Authentic Aesthetics",
  "Palmyra Pharmacy",
  "Medirite Langverwacht",
  "Medirite St Johns",
  "Medirite Dasport",
  "Medirite Olivedale",
];

const doctors = [
  "All Doctors",
  "Dr Khumalo",
  "Dr Jemma Salvage",
  "Dr Chika",
  "Dr Yusra Khan",
  "Dr Ayesha Cassiem",
];

const siteColors: Record<string, string> = {
  "Authentic Aesthetics": "#d1ecf1",
  "Palmyra Pharmacy": "#d4edda",
  "Medirite Langverwacht": "#fff3cd",
  "Medirite St Johns": "#f8d7da",
  "Medirite Dasport": "#e2e3e5",
  "Medirite Olivedale": "#d6d8ff",
};

export default function CalendarPage() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [view, setView] = useState<"day" | "week" | "month">("day");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [siteFilter, setSiteFilter] = useState("All Sites");
  const [doctorFilter, setDoctorFilter] = useState("All Doctors");

  useEffect(() => {
    loadAppointments();
  }, []);

  async function loadAppointments() {
    const { data, error } = await supabase
      .from("appointments")
      .select(`
        *,
        patients (
          id,
          first_name,
          surname,
          mobile_number,
          doctor,
          clinic_site,
          medication,
          current_dose
        )
      `)
      .order("appointment_date", { ascending: true })
      .order("appointment_time", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setAppointments(data || []);
  }

  async function markCompleted(id: string) {
    const { error } = await supabase
      .from("appointments")
      .update({ status: "completed" })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    loadAppointments();
  }

  const slots = useMemo(() => {
    const arr: string[] = [];
    for (let hour = 9; hour <= 18; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        if (hour === 18 && minute > 0) continue;
        arr.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
      }
    }
    return arr;
  }, []);

  function getWeekDates(dateString: string) {
    const date = new Date(dateString);
    const day = date.getDay();
    const monday = new Date(date);
    monday.setDate(date.getDate() - ((day + 6) % 7));

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d.toISOString().split("T")[0];
    });
  }

  function getMonthDates(dateString: string) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth();

    const days = new Date(year, month + 1, 0).getDate();

    return Array.from({ length: days }, (_, i) => {
      const d = new Date(year, month, i + 1);
      return d.toISOString().split("T")[0];
    });
  }

  function filteredAppointments(date?: string, time?: string) {
    return appointments.filter((a) => {
      const site = a.site || a.patients?.clinic_site;
      const doctor = a.doctor || a.patients?.doctor;

      if (siteFilter !== "All Sites" && site !== siteFilter) return false;
      if (doctorFilter !== "All Doctors" && doctor !== doctorFilter) return false;
      if (date && a.appointment_date !== date) return false;
      if (time && a.appointment_time?.substring(0, 5) !== time) return false;

      return true;
    });
  }

  function isMissed(a: any) {
    const now = new Date();
    const appointmentDateTime = new Date(`${a.appointment_date}T${a.appointment_time || "09:00"}`);
    return appointmentDateTime < now && a.status === "scheduled";
  }

  function AppointmentCard({ appointment }: { appointment: any }) {
    const site = appointment.site || appointment.patients?.clinic_site;
    const bg = isMissed(appointment) ? "#ffcccc" : siteColors[site] || "#eee";

    return (
      <div style={{ background: bg, padding: 10, borderRadius: 6, marginBottom: 8 }}>
        <Link href={`/dosetrack/patient/${appointment.patient_id}`}>
          <strong>
            {appointment.patients?.first_name} {appointment.patients?.surname}
          </strong>
        </Link>

        <div>Dose: {appointment.patients?.current_dose}</div>
        <div>Pen dose: {appointment.pen_dose_number || "-"} of 6</div>
        <div>Doctor: {appointment.doctor || appointment.patients?.doctor}</div>
        <div>Site: {site}</div>
        <div>Mobile: {appointment.patients?.mobile_number}</div>
        <div>Status: {isMissed(appointment) ? "MISSED / OVERDUE" : appointment.status}</div>

        {appointment.status !== "completed" && (
          <button
            onClick={() => markCompleted(appointment.id)}
            style={{ marginTop: 8, padding: 8 }}
          >
            Mark Completed
          </button>
        )}
      </div>
    );
  }

  const dates =
    view === "day"
      ? [selectedDate]
      : view === "week"
      ? getWeekDates(selectedDate)
      : getMonthDates(selectedDate);

  return (
    <main style={{ padding: 24 }}>
      <Link href="/dosetrack">
        <button>← Back to Dashboard</button>
      </Link>

      <h1>Injection Calendar</h1>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20 }}>
        <select value={view} onChange={(e) => setView(e.target.value as any)}>
          <option value="day">Day View</option>
          <option value="week">Week View</option>
          <option value="month">Month View</option>
        </select>

        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />

        <select value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}>
          {sites.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>

        <select value={doctorFilter} onChange={(e) => setDoctorFilter(e.target.value)}>
          {doctors.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>

        <button onClick={loadAppointments}>Refresh</button>
      </div>

      {view === "day" && (
        <div style={{ marginTop: 20, border: "1px solid #ddd" }}>
          {slots.map((slot) => {
            const items = filteredAppointments(selectedDate, slot);

            return (
              <div
                key={slot}
                style={{
                  display: "grid",
                  gridTemplateColumns: "100px 1fr",
                  borderBottom: "1px solid #eee",
                  minHeight: 70,
                }}
              >
                <div style={{ padding: 12, borderRight: "1px solid #eee" }}>
                  {slot}
                </div>

                <div style={{ padding: 12 }}>
                  {items.length === 0 ? (
                    <span style={{ color: "#999" }}>Available</span>
                  ) : (
                    items.map((a) => <AppointmentCard key={a.id} appointment={a} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === "week" && (
        <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "100px repeat(7, 1fr)", border: "1px solid #ddd" }}>
          <div style={{ padding: 10 }}></div>

          {dates.map((date) => (
            <div key={date} style={{ padding: 10, fontWeight: 700, borderLeft: "1px solid #ddd" }}>
              {date}
            </div>
          ))}

          {slots.map((slot) => (
            <>
              <div key={`${slot}-time`} style={{ padding: 10, borderTop: "1px solid #eee" }}>
                {slot}
              </div>

              {dates.map((date) => {
                const items = filteredAppointments(date, slot);

                return (
                  <div key={`${date}-${slot}`} style={{ padding: 8, borderTop: "1px solid #eee", borderLeft: "1px solid #eee", minHeight: 80 }}>
                    {items.map((a) => <AppointmentCard key={a.id} appointment={a} />)}
                  </div>
                );
              })}
            </>
          ))}
        </div>
      )}

      {view === "month" && (
        <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 10 }}>
          {dates.map((date) => {
            const items = filteredAppointments(date);

            return (
              <div key={date} style={{ border: "1px solid #ddd", minHeight: 160, padding: 10 }}>
                <strong>{date}</strong>

                <div style={{ marginTop: 8 }}>
                  {items.length === 0 ? (
                    <span style={{ color: "#999" }}>No injections</span>
                  ) : (
                    items.map((a) => <AppointmentCard key={a.id} appointment={a} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
