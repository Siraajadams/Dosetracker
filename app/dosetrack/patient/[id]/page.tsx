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

  useEffect(() => {
    loadPatient();
  }, []);

  async function loadPatient() {
    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .eq("patient_clinic_id", patientId)
      .single();

    if (!error && data) {
      setPatient(data);
    }

    setLoading(false);
  }

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        <h2>Loading patient...</h2>
      </main>
    );
  }

  if (!patient) {
    return (
      <main style={{ padding: 24 }}>
        <h2>Patient not found</h2>

        <Link href="/dosetrack">
          <button>Back to Dashboard</button>
        </Link>
      </main>
    );
  }

  return (
    <main style={{ padding: 24 }}>
      <Link href="/dosetrack">
        <button style={{ marginBottom: 20 }}>
          ← Back to Dashboard
        </button>
      </Link>

      <h1>
        {patient.first_name} {patient.surname}
      </h1>

      <div
        style={{
          display: "grid",
          gap: 12,
          marginTop: 20,
          maxWidth: 800,
        }}
      >
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

      <div
        style={{
          marginTop: 30,
          display: "flex",
          gap: 12,
        }}
      >
        <button
          style={{
            padding: 12,
            background: "#000",
            color: "#fff",
            border: "none",
          }}
        >
          Record Injection
        </button>

        <button
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
