"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

const doses = ["10mg", "7.5mg", "5mg", "3.75mg", "2.5mg", "1mg", "0.5mg", "0.25mg"];

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
    setNewDose(data?.current_dose || "");
    setLoading(false);
  }

  async function recordInjection() {
    if (!patient) return;

    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    const injectionDate = today.toISOString();
    const nextInjectionDate = nextWeek.toISOString().split("T")[0];

    const { data: previousInjections } = await supabase
      .from("injections")
      .select("id")
      .eq("patient_id", patient.id);

    const injectionCount = previousInjections?.length || 0;
    const currentPenDose = (injectionCount % 6) + 1;
    const nextPenDose = currentPenDose === 6 ? 1 : currentPenDose + 1;

    const { error: injectionError } = await supabase.from("injections").insert([
      {
        patient_id: patient.id,
        injection_date: injectionDate,
        next_injection_date: nextInjectionDate,
        dose_given: patient.current_dose,
        pen_dose_number: currentPenDose,
        notes: `Dose ${currentPenDose} of 6 recorded`,
      },
    ]);

    if (injectionError) {
      alert(injectionError.message);
      return;
    }

    const { error: appointmentError } = await supabase.from("appointments").insert([
      {
        patient_id: patient.id,
        appointment_date: nextInjectionDate,
        appointment_time: "09:00",
        duration_minutes: 15,
        status: "scheduled",
        site: patient.clinic_site,
        doctor: patient.doctor,
        pen_dose_number: nextPenDose,
        recurring_weekly: true,
      },
    ]);

    if (appointmentError) {
      alert(appointmentError.message);
      return;
    }

    alert(
      `Injection recorded successfully.\n\nDose ${currentPenDose} of 6.\nNext appointment created for ${nextInjectionDate}.`
    );
  }

  async function changeDose() {
    if (!patient || !newDose) {
      alert("Please select the new prescribed dose.");
      return;
    }

    const { error: logError } = await supabase.from("dose_changes").insert([
      {
        patient_id: patient.id,
        old_dose: patient.current_dose,
        new_dose: newDose,
        status: "completed",
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

    alert("Patient dose updated successfully.");
    loadPatient();
  }

  if (loading) return <main style={{ padding: 24 }}>Loading patient...</main>;
  if (!patient) return <main style={{ padding: 24 }}>Patient not found.</main>;

  const cardStyle = {
    background: "#fff",
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
          <button style={{ padding: 10, borderRadius: 8 }}>← Dashboard</button>
        </Link>

        <Link href="/dosetrack/calendar">
          <button style={{ padding: 10, borderRadius: 8 }}>Open Calendar</button>
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
        <p>Weekly GLP-1 injection profile and dose tracking.</p>
        <strong>Current Dose: {patient.current_dose}</strong>
      </section>

      <section
        style={{
          display: "grid",
          gap: 14,
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        }}
      >
        {[
          ["Patient Clinic ID", patient.patient_clinic_id],
          ["ID / Passport Number", patient.id_number],
          ["Mobile Number", patient.mobile_number],
          ["Gender", patient.gender],
          ["Country", patient.country],
          ["Doctor", patient.doctor],
          ["Clinic Site", patient.clinic_site],
          ["Medication", patient.medication],
          ["Status", patient.status],
        ].map(([label, value]) => (
          <div key={label} style={cardStyle}>
            <strong>{label}</strong>
            <p>{value || "-"}</p>
          </div>
        ))}
      </section>

      <section
        style={{
          marginTop: 28,
          display: "grid",
          gap: 20,
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        }}
      >
        <div style={cardStyle}>
          <h2>1. Record Today&apos;s Injection</h2>
          <p>
            Use this when the patient has received today&apos;s injection. This will
            date-stamp the injection and create the next weekly appointment.
          </p>

          <button
            onClick={recordInjection}
            style={{
              padding: 14,
              width: "100%",
              borderRadius: 10,
              border: "none",
              background: "#0f766e",
              color: "white",
              fontWeight: "bold",
            }}
          >
            Confirm Injection Given Today
          </button>
        </div>

        <div style={cardStyle}>
          <h2>2. Change Prescribed Dose</h2>
          <p>
            Use this only when the doctor has changed the patient&apos;s dose plan.
            This updates the patient profile.
          </p>

          <select
            value={newDose}
            onChange={(e) => setNewDose(e.target.value)}
            style={{
              padding: 12,
              width: "100%",
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              marginBottom: 12,
            }}
          >
            <option value="">Select New Prescribed Dose</option>
            {doses.map((dose) => (
              <option key={dose}>{dose}</option>
            ))}
          </select>

          <button
            onClick={changeDose}
            style={{
              padding: 14,
              width: "100%",
              borderRadius: 10,
              border: "none",
              background: "#2563eb",
              color: "white",
              fontWeight: "bold",
            }}
          >
            Update Patient Dose Plan
          </button>
        </div>
      </section>
    </main>
  );
}
