"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

export default function CalendarPage() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );

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
          clinic_site,
          doctor,
          current_dose
        )
      `)
      .order("appointment_date", { ascending: true });

    if (!error && data) {
      setAppointments(data);
    }
  }

  const slots = [];

  for (let hour = 9; hour < 18; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const h = String(hour).padStart(2, "0");
      const m = String(minute).padStart(2, "0");

      slots.push(`${h}:${m}`);
    }
  }

  return (
    <main style={{ padding: 24 }}>
      <Link href="/dosetrack">
        <button>← Back to Dashboard</button>
      </Link>

      <h1 style={{ marginTop: 20 }}>
        Injection Calendar
      </h1>

      <div style={{ marginTop: 20 }}>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
      </div>

      <div
        style={{
          marginTop: 30,
          border: "1px solid #ddd",
        }}
      >
        {slots.map((slot) => {
          const appointment = appointments.find(
            (a) =>
              a.appointment_date === selectedDate &&
              a.appointment_time?.substring(0, 5) === slot
          );

          return (
            <div
              key={slot}
              style={{
                display: "grid",
                gridTemplateColumns: "120px 1fr",
                borderBottom: "1px solid #eee",
                minHeight: 70,
              }}
            >
              <div
                style={{
                  padding: 12,
                  fontWeight: 600,
                  borderRight: "1px solid #eee",
                }}
              >
                {slot}
              </div>

              <div style={{ padding: 12 }}>
                {appointment ? (
                  <Link
                    href={`/dosetrack/patient/${appointment.patient_id}`}
                    style={{
                      textDecoration: "none",
                    }}
                  >
                    <div
                      style={{
                        background: "#d1ecf1",
                        padding: 10,
                        borderRadius: 6,
                      }}
                    >
                      <strong>
                        {appointment.patients?.first_name}{" "}
                        {appointment.patients?.surname}
                      </strong>

                      <div>
                        Dose: {appointment.patients?.current_dose}
                      </div>

                      <div>
                        Doctor: {appointment.patients?.doctor}
                      </div>

                      <div>
                        Site: {appointment.patients?.clinic_site}
                      </div>

                      <div>
                        Mobile: {appointment.patients?.mobile_number}
                      </div>
                    </div>
                  </Link>
                ) : (
                  <span style={{ color: "#999" }}>
                    Available
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
