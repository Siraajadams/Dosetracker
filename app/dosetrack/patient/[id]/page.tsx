"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Patient = {
  id: string;
  clinic_id: string;
  first_name: string;
  surname: string;
  id_number: string;
  mobile: string;
  dob: string;
  gender: string;
  country: string;
  height: number;
  starting_weight: number;
  current_weight: number;
  current_dose: string;
  pen_number: number;
  dose_number: number;
  next_appointment: string;
  status: string;
};

const doseOptions = [
  "0.25mg",
  "0.5mg",
  "1mg",
  "2.5mg",
  "3.75mg",
  "5mg",
  "7.5mg",
  "10mg",
];

export default function PatientProfilePage() {
  const params = useParams();
  const patientId = params.id as string;

  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentWeight, setCurrentWeight] = useState("");
  const [notes, setNotes] = useState("");
  const [newDose, setNewDose] = useState("");
  const [message, setMessage] = useState("");

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
      setMessage(error.message);
    } else {
      setPatient(data);
      setCurrentWeight(String(data.current_weight || data.starting_weight || ""));
      setNewDose(data.current_dose || "");
    }

    setLoading(false);
  }

  function calculateAge(dob: string) {
    if (!dob) return "";
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  }

  function calculateBMI(weight: number, heightCm: number) {
    if (!weight || !heightCm) return 0;
    const heightM = heightCm / 100;
    return Number((weight / (heightM * heightM)).toFixed(1));
  }

  function addSevenDays(dateString?: string) {
    const base = dateString ? new Date(dateString) : new Date();
    base.setDate(base.getDate() + 7);
    return base.toISOString().split("T")[0];
  }

  async function recordInjection() {
    if (!patient) return;

    const weight = Number(currentWeight);

    if (!weight || weight <= 0) {
      alert("Please enter the patient's current weight.");
      return;
    }

    const nextDoseNumber = patient.dose_number >= 6 ? 1 : patient.dose_number + 1;
    const nextPenNumber =
      patient.dose_number >= 6 ? patient.pen_number + 1 : patient.pen_number;

    const nextAppointment = addSevenDays();

    const weightLost = Number(
      ((patient.starting_weight || weight) - weight).toFixed(1)
    );

    const bmi = calculateBMI(weight, patient.height);

    const { error: injectionError } = await supabase.from("injections").insert({
      patient_id: patient.id,
      injection_date: new Date().toISOString().split("T")[0],
      weight,
      dose: patient.current_dose,
      pen_number: patient.pen_number,
      dose_number: patient.dose_number,
      notes,
    });

    if (injectionError) {
      alert(injectionError.message);
      return;
    }

    const { error: updateError } = await supabase
      .from("patients")
      .update({
        current_weight: weight,
        weight_lost: weightLost,
        bmi,
        dose_number: nextDoseNumber,
        pen_number: nextPenNumber,
        next_appointment: nextAppointment,
      })
      .eq("id", patient.id);

    if (updateError) {
      alert(updateError.message);
      return;
    }

    setMessage("Injection and weight updated successfully.");
    setNotes("");
    loadPatient();
  }

  async function confirmDoseChange() {
    if (!patient || !newDose) return;

    const { error: doseLogError } = await supabase.from("dose_changes").insert({
      patient_id: patient.id,
      old_dose: patient.current_dose,
      new_dose: newDose,
      status: "approved",
      notes: "Dose changed from patient profile",
    });

    if (doseLogError) {
      alert(doseLogError.message);
      return;
    }

    const { error } = await supabase
      .from("patients")
      .update({ current_dose: newDose })
      .eq("id", patient.id);

    if (error) {
      alert(error.message);
      return;
    }

    setMessage("Dose updated successfully.");
    loadPatient();
  }

  if (loading) return <main style={{ padding: 30 }}>Loading patient...</main>;

  if (!patient) return <main style={{ padding: 30 }}>Patient not found.</main>;

  const bmi = calculateBMI(patient.current_weight, patient.height);
  const weightLost = Number(
    ((patient.starting_weight || 0) - (patient.current_weight || 0)).toFixed(1)
  );

  return (
    <main style={{ padding: 30, fontFamily: "Arial, sans-serif", background: "#f8fafc" }}>
      <Link href="/dosetrack">← Back to Dashboard</Link>

      <div
        style={{
          marginTop: 20,
          padding: 30,
          borderRadius: 20,
          color: "white",
          background: "linear-gradient(135deg, #0f766e, #2563eb)",
        }}
      >
        <h1>
          {patient.first_name} {patient.surname}
        </h1>
        <p>
          {patient.current_dose} | Pen {patient.pen_number} | Dose{" "}
          {patient.dose_number} of 6
        </p>
      </div>

      {message && (
        <div
          style={{
            marginTop: 20,
            padding: 15,
            borderRadius: 12,
            background: "#dcfce7",
            color: "#166534",
          }}
        >
          {message}
        </div>
      )}

      <section
        style={{
          marginTop: 25,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        <Info title="Patient Clinic ID" value={patient.clinic_id} />
        <Info title="ID / Passport" value={patient.id_number} />
        <Info title="Mobile" value={patient.mobile} />
        <Info
          title="DOB / Age"
          value={`${patient.dob || ""} / ${calculateAge(patient.dob)} years`}
        />
        <Info title="Gender" value={patient.gender} />
        <Info title="Country" value={patient.country} />
        <Info title="Height" value={`${patient.height || 0} cm`} />
        <Info title="Starting Weight" value={`${patient.starting_weight || 0} kg`} />
        <Info title="Current Weight" value={`${patient.current_weight || 0} kg`} />
        <Info title="Weight Lost" value={`${weightLost} kg`} />
        <Info title="BMI" value={String(bmi)} />
        <Info title="Next Appointment" value={patient.next_appointment} />
        <Info title="Pen Number" value={`Pen ${patient.pen_number}`} />
        <Info title="Dose Number" value={`Dose ${patient.dose_number} of 6`} />
        <Info title="Status" value={patient.status} />
      </section>

      <section
        style={{
          marginTop: 30,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 24,
        }}
      >
        <div style={card}>
          <h2>Record Today’s Injection</h2>
          <p>
            Use this after the patient receives their weekly injection. This
            updates weight, BMI, weight loss, dose number, pen usage and next
            appointment.
          </p>

          <label>Current Weight Today (kg)</label>
          <input
            type="number"
            step="0.1"
            value={currentWeight}
            onChange={(e) => setCurrentWeight(e.target.value)}
            style={input}
            placeholder="Enter current weight"
          />

          <label>Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ ...input, height: 90 }}
            placeholder="Optional notes"
          />

          <button onClick={recordInjection} style={greenButton}>
            Record Injection Given Today
          </button>
        </div>

        <div style={card}>
          <h2>Change Dose</h2>
          <p>
            Use this only when the doctor changes the patient’s prescribed dose.
            The change is logged for audit and monthly reporting.
          </p>

          <select
            value={newDose}
            onChange={(e) => setNewDose(e.target.value)}
            style={input}
          >
            <option value="">Select New Dose</option>
            {doseOptions.map((dose) => (
              <option key={dose} value={dose}>
                {dose}
              </option>
            ))}
          </select>

          <button onClick={confirmDoseChange} style={blueButton}>
            Confirm Dose Change
          </button>
        </div>
      </section>
    </main>
  );
}

function Info({ title, value }: { title: string; value: string | number }) {
  return (
    <div
      style={{
        background: "white",
        padding: 20,
        borderRadius: 16,
        boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
      }}
    >
      <h3 style={{ marginBottom: 8 }}>{title}</h3>
      <p>{value || "-"}</p>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "white",
  padding: 24,
  borderRadius: 18,
  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
};

const input: React.CSSProperties = {
  width: "100%",
  padding: 14,
  marginTop: 8,
  marginBottom: 16,
  borderRadius: 10,
  border: "1px solid #cbd5e1",
};

const greenButton: React.CSSProperties = {
  width: "100%",
  padding: 14,
  border: "none",
  borderRadius: 12,
  background: "#0f766e",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
};

const blueButton: React.CSSProperties = {
  width: "100%",
  padding: 14,
  border: "none",
  borderRadius: 12,
  background: "#2563eb",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
};
