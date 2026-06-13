"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function CalendarPage() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
          doctor,
          clinic_site,
          medication,
          current_dose,
          mobile_number
        )
      `)
      .order("appointment_date", { ascending: true });

    if (error) {
      console.error(error);
    }

    setAppointments(data || []);
    setLoading(false);
  }

  async function markCompleted(id: string) {
    const { error } = await supabase
      .from("appointments")
      .update({
        status: "completed",
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    loadAppointments();
  }

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        Loading Calendar...
      </main>
    );
  }

  return (
    <main style={{ padding: 24 }}>
      <Link href="/dosetrack">
        <button
          style={{
            padding: 10,
            marginBottom: 20,
          }}
        >
          ← Back to Dashboard
        </button>
      </Link>

      <h1>Injection Calendar</h1>

      <p>
        Weekly injection appointments scheduled automatically
        after each recorded dose.
      </p>

      <div
        style={{
          display: "grid",
          gap: 16,
          marginTop: 20,
        }}
      >
        {appointments.length === 0 && (
          <div>No upcoming appointments.</div>
        )}

        {appointments.map((appointment) => (
          <div
            key={appointment.id}
            style={{
              border: "1px solid #ddd",
              padding: 20,
              borderRadius: 8,
            }}
          >
            <h3>
              {appointment.patients?.first_name}{" "}
              {appointment.patients?.surname}
            </h3>

            <p>
              <strong>Date:</strong>{" "}
              {appointment.appointment_date}
            </p>

            <p>
              <strong>Time:</strong>{" "}
              {appointment.appointment_time}
            </p>

            <p>
              <strong>Doctor:</strong>{" "}
              {appointment.patients?.doctor}
            </p>

            <p>
              <strong>Clinic:</strong>{" "}
              {appointment.patients?.clinic_site}
            </p>

            <p>
              <strong>Medication:</strong>{" "}
              {appointment.patients?.medication}
            </p>

            <p>
              <strong>Dose:</strong>{" "}
              {appointment.patients?.current_dose}
            </p>

            <p>
              <strong>Mobile:</strong>{" "}
              {appointment.patients?.mobile_number}
            </p>

            <p>
              <strong>Status:</strong>{" "}
              {appointment.status}
            </p>

            <button
              onClick={() => markCompleted(appointment.id)}
              style={{
                padding: 10,
                background: "#198754",
                color: "white",
                border: "none",
                cursor: "pointer",
                marginTop: 10,
              }}
            >
              Mark Completed
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
