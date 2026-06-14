"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

const doseOptions = [
  "10mg",
  "7.5mg",
  "5mg",
  "3.75mg",
  "2.5mg",
  "1mg",
  "0.5mg",
  "0.25mg",
];

export default function PatientProfilePage() {
  const params = useParams();
  const patientId = params.id as string;

  const [patient, setPatient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [newDose, setNewDose] = useState("");

  useEffect(() => {
    loadPatient();
  }, []);

  async function loadPatient() {
    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .eq("id", patientId)
      .single();

    if (error) console.error(error);

    setPatient(data);
    setLoading(false);
  }

  async function recordInjection() {
    if (!patient) return;

    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);

    const injectionDate = today.toISOString();
    const nextAppointmentDate = nextWeek.toISOString().split("T")[0];

    const currentDoseNumber = patient.dose_number || 1;
    const currentPenNumber = patient.pen_number || 1;

    const nextDoseNumber = currentDoseNumber >= 6 ? 1 : currentDoseNumber + 1;
    const nextPenNumber =
      currentDoseNumber >= 6 ? currentPenNumber + 1 : currentPenNumber;

    const { error: injectionError } = await supabase.from("injections").insert([
      {
        patient_id: patient.id,
        injection_date: injectionDate,
        next_injection_date: nextAppointmentDate,
        dose_given: patient.current_dose,
        dose_number: currentDoseNumber,
        pen_number: currentPenNumber,
        notes: "Weekly injection recorded",
      },
    ]);

    if (injectionError) {
      alert(injectionError.message);
      return;
    }

    const { error: appointmentError } = await supabase
      .from("appointments")
      .insert([
        {
          patient_id: patient.id,
          appointment_date: nextAppointmentDate,
          appointment_time: "09:00",
          status: "scheduled",
        },
      ]);

    if (appointmentError) {
      alert(appointmentError.message);
      return;
    }

    const { error: updateError } = await supabase
      .from("patients")
      .update({
        next_appointment_date: nextAppointmentDate,
        dose_number: nextDoseNumber,
        pen_number: nextPenNumber,
      })
      .eq("id", patient.id);

    if (updateError) {
      alert(updateError.message);
      return;
    }

    alert(
      `Injection recorded successfully.\n\nDose ${currentDoseNumber} of 6.\nNext appointment created for ${nextAppointmentDate}.`
    );

    loadPatient();
  }

  async function changeDose() {
    if (!patient) return;

    if (!newDose) {
      alert("Please select a new dose.");
      return;
    }

    const { error: logError } = await supabase.from("dose_changes").insert([
      {
        patient_id: patient.id,
        old_dose: patient.current_dose,
        new_dose: newDose,
        status: "pending",
      },
    ]);

    if (logError) {
      alert(logError.message);
      return;
    }

    const { error: updateError } = await supabase
      .from("patients")
      .update({ current_dose: newDose })
      .eq("id", patient.id);

    if (updateError) {
      alert(updateError.message);
      return;
    }

    alert("Dose changed and logged for audit.");
    setNewDose("");
    loadPatient();
  }

  if (loading) {
    return <main style={{ padding: 24 }}>Loading patient...</main>;
  }

  if (!patient) {
    return <main style={{ padding: 24 }}>Patient not found.</main>;
  }

  const weightLost =
    Number(patient.starting_weight || 0) - Number(patient.current_weight || 0);

  const cardStyle = {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 18,
    boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 24,
        background: "linear-gradient(135deg, #eef7ff, #f8fafc)",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <Link href="/dosetrack">
          <button>← Back to Dashboard</button>
        </Link>

        <Link href="/dosetrack/calendar">
          <button>Open Injection Calendar</button>
        </Link>

        <Link href="/dosetrack/reports">
          <button>Monthly Reports</button>
        </Link>
      </div>

      <section
        style={{
          background: "linear-gradient(135deg, #0f766e, #2563eb)",
          color: "white",
          padding: 28,
          borderRadius: 18,
          marginBottom: 24,
        }}
      >
        <h1 style={{ margin: 0 }}>
          {patient.first_name} {patient.surname}
        </h1>
        <p>
          {patient.clinic_site} | {patient.doctor} | Current Dose:{" "}
          {patient.current_dose}
        </p>
      </section>

      <section
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
        <div style={cardStyle}>
          <strong>Patient Clinic ID</strong>
          <p>{patient.patient_clinic_id}</p>
        </div>

        <div style={cardStyle}>
          <strong>ID / Passport</strong>
          <p>{patient.id_number}</p>
        </div>

        <div style={cardStyle}>
          <strong>Mobile</strong>
          <p>{patient.mobile_number}</p>
        </div>

        <div style={cardStyle}>
          <strong>DOB / Age</strong>
          <p>
            {patient.dob || "Not captured"} / {patient.age || "-"} years
          </p>
        </div>

        <div style={cardStyle}>
          <strong>Gender</strong>
          <p>{patient.gender}</p>
        </div>

        <div style={cardStyle}>
          <strong>Country</strong>
          <p>{patient.country}</p>
        </div>

        <div style={cardStyle}>
          <strong>Height</strong>
          <p>{patient.height_cm || "-"} cm</p>
        </div>

        <div style={cardStyle}>
          <strong>Starting Weight</strong>
          <p>{patient.starting_weight || "-"} kg</p>
        </div>

        <div style={cardStyle}>
          <strong>Current Weight</strong>
          <p>{patient.current_weight || "-"} kg</p>
        </div>

        <div style={cardStyle}>
          <strong>Weight Lost</strong>
          <p>{weightLost.toFixed(1)} kg</p>
        </div>

        <div style={cardStyle}>
          <strong>BMI</strong>
          <p>{patient.bmi || "-"}</p>
        </div>

        <div style={cardStyle}>
          <strong>Next Appointment</strong>
          <p>{patient.next_appointment_date || "Not scheduled"}</p>
        </div>

        <div style={cardStyle}>
          <strong>Pen Number</strong>
          <p>Pen {patient.pen_number || 1}</p>
        </div>

        <div style={cardStyle}>
          <strong>Dose Number</strong>
          <p>Dose {patient.dose_number || 1} of 6</p>
        </div>

        <div style={cardStyle}>
          <strong>Status</strong>
          <p>{patient.status}</p>
        </div>
      </section>

      <section
        style={{
          marginTop: 28,
          display: "grid",
          gap: 18,
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        }}
      >
        <div style={cardStyle}>
          <h2>Record Today’s Injection</h2>
          <p>
            Use this after the patient receives their weekly injection. This
            records the dose, updates dose number, tracks pen usage and creates
            next week’s appointment.
          </p>

          <button
            onClick={recordInjection}
            style={{
              width: "100%",
              padding: 14,
              background: "#0f766e",
              color: "white",
              border: "none",
              borderRadius: 10,
              fontWeight: "bold",
            }}
          >
            Record Injection Given Today
          </button>
        </div>

        <div style={cardStyle}>
          <h2>Change Dose</h2>
          <p>
            Use this only when the doctor changes the patient’s prescribed dose.
            The change is logged for audit and monthly reporting.
          </p>

          <select
            value={newDose}
            onChange={(e) => setNewDose(e.target.value)}
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              marginBottom: 12,
            }}
          >
            <option value="">Select New Dose</option>
            {doseOptions.map((dose) => (
              <option key={dose}>{dose}</option>
            ))}
          </select>

          <button
            onClick={changeDose}
            style={{
              width: "100%",
              padding: 14,
              background: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: 10,
              fontWeight: "bold",
            }}
          >
            Confirm Dose Change
          </button>
        </div>
      </section>
    </main>
  );
}
