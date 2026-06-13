"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

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

    if (error) {
      console.error(error);
    }

    setPatient(data);
    setLoading(false);
  }

  async function recordInjection() {
    if (!patient) return;

    const { error } = await supabase.from("injections").insert([
      {
        patient_id: patient.id,
        dose_given: patient.current_dose,
        notes: "Injection recorded",
      },
    ]);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Injection recorded successfully.");
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

    alert("Dose changed successfully.");
    setNewDose("");
    loadPatient();
  }

  if (loading) {
    return <main style={{ padding: 24 }}>Loading patient...</main>;
  }

  if (!patient) {
    return <main style={{ padding: 24 }}>Patient not found.</main>;
  }

  return (
    <main style={{ padding: 24 }}>
      <Link href="/dosetrack">
        <button style={{ marginBottom: 20 }}>← Back to Dashboard</button>
      </Link>

      <h1>
        {patient.first_name} {patient.surname}
      </h1>

      <div style={{ display: "grid", gap: 12, maxWidth: 800 }}>
        <div style={{ border: "1px solid #ddd", padding: 16 }}>
          <strong>Patient Clinic ID</strong>
          <p>{patient.patient_clinic_id}</p>
        </div>

        <div style={{ border: "1px solid #ddd", padding: 16 }}>
          <strong>ID / Passport Number</strong>
          <p>{patient.id_number}</p>
        </div>

        <div style={{ border: "1px solid #ddd", padding: 16 }}>
          <strong>Mobile Number</strong>
          <p>{patient.mobile_number}</p>
        </div>

        <div style={{ border: "1px solid #ddd", padding: 16 }}>
          <strong>Gender</strong>
          <p>{patient.gender}</p>
        </div>

        <div style={{ border: "1px solid #ddd", padding: 16 }}>
          <strong>Country</strong>
          <p>{patient.country}</p>
        </div>

        <div style={{ border: "1px solid #ddd", padding: 16 }}>
          <strong>Doctor</strong>
          <p>{patient.doctor}</p>
        </div>

        <div style={{ border: "1px solid #ddd", padding: 16 }}>
          <strong>Clinic Site</strong>
          <p>{patient.clinic_site}</p>
        </div>

        <div style={{ border: "1px solid #ddd", padding: 16 }}>
          <strong>Medication</strong>
          <p>{patient.medication}</p>
        </div>

        <div style={{ border: "1px solid #ddd", padding: 16 }}>
          <strong>Current Dose</strong>
          <p>{patient.current_dose}</p>
        </div>

        <div style={{ border: "1px solid #ddd", padding: 16 }}>
          <strong>Status</strong>
          <p>{patient.status}</p>
        </div>
      </div>

      <div style={{ marginTop: 30, display: "grid", gap: 12, maxWidth: 400 }}>
        <button
          onClick={recordInjection}
          style={{
            padding: 12,
            background: "#000",
            color: "#fff",
            border: "none",
          }}
        >
          Record Injection
        </button>

        <select value={newDose} onChange={(e) => setNewDose(e.target.value)}>
          <option value="">Select New Dose</option>
          <option>10mg</option>
          <option>7.5mg</option>
          <option>5mg</option>
          <option>3.75mg</option>
          <option>2.5mg</option>
          <option>1mg</option>
          <option>0.5mg</option>
          <option>0.25mg</option>
        </select>

        <button
          onClick={changeDose}
          style={{
            padding: 12,
            background: "#0d6efd",
            color: "#fff",
            border: "none",
          }}
        >
          Change Dose
        </button>
      </div>
    </main>
  );
}
