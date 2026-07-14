"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Patient = {
  id: string;
  first_name: string;
  surname: string;
  id_number: string | null;
  mobile_number: string | null;
  dob: string | null;
  gender: string | null;
  country: string | null;
  height_cm: number | null;
  starting_weight: number | null;
  current_weight: number | null;
  weight_lost: number | null;
  bmi: number | null;
  current_dose: string | null;
  pen_number: number | null;
  dose_number: number | null;
  status: string | null;
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
  const patientId = String(params.id || "");

  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingInjection, setSavingInjection] = useState(false);
  const [savingDose, setSavingDose] = useState(false);

  const [currentWeight, setCurrentWeight] = useState("");
  const [notes, setNotes] = useState("");
  const [newDose, setNewDose] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const loadPatient = useCallback(async () => {
    if (!patientId) {
      setPatient(null);
      setLoading(false);
      setErrorMessage("Patient ID is missing.");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("patients")
      .select(`
        id,
        first_name,
        surname,
        id_number,
        mobile_number,
        dob,
        gender,
        country,
        height_cm,
        starting_weight,
        current_weight,
        weight_lost,
        bmi,
        current_dose,
        pen_number,
        dose_number,
        status
      `)
      .eq("id", patientId)
      .single();

    if (error) {
      console.error("Patient load error:", error);

      setPatient(null);
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    const loadedPatient = data as Patient;

    setPatient(loadedPatient);

    setCurrentWeight(
      String(
        loadedPatient.current_weight ??
          loadedPatient.starting_weight ??
          ""
      )
    );

    setNewDose(loadedPatient.current_dose ?? "");
    setLoading(false);
  }, [patientId]);

  useEffect(() => {
    loadPatient();
  }, [loadPatient]);

  function calculateAge(dob?: string | null) {
    if (!dob) return null;

    const birthDate = new Date(dob);

    if (Number.isNaN(birthDate.getTime())) {
      return null;
    }

    const today = new Date();

    let age =
      today.getFullYear() - birthDate.getFullYear();

    const monthDifference =
      today.getMonth() - birthDate.getMonth();

    if (
      monthDifference < 0 ||
      (monthDifference === 0 &&
        today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    return age;
  }

  function calculateBMI(
    weight?: number | null,
    heightCm?: number | null
  ) {
    const validWeight = Number(weight || 0);
    const validHeightCm = Number(heightCm || 0);

    if (validWeight <= 0 || validHeightCm <= 0) {
      return 0;
    }

    const heightMetres = validHeightCm / 100;

    return Number(
      (
        validWeight /
        Math.pow(heightMetres, 2)
      ).toFixed(1)
    );
  }

  async function recordInjection() {
    if (!patient || savingInjection) return;

    setMessage("");
    setErrorMessage("");

    const weight = Number(currentWeight);

    if (!weight || weight <= 0) {
      setErrorMessage(
        "Please enter the patient's current weight."
      );
      return;
    }

    setSavingInjection(true);

    try {
      const currentDoseNumber = Number(
        patient.dose_number || 1
      );

      const currentPenNumber = Number(
        patient.pen_number || 1
      );

      const nextDoseNumber =
        currentDoseNumber >= 6
          ? 1
          : currentDoseNumber + 1;

      const nextPenNumber =
        currentDoseNumber >= 6
          ? currentPenNumber + 1
          : currentPenNumber;

      const startingWeight =
        Number(patient.starting_weight || 0) ||
        weight;

      const weightLost = Number(
        Math.max(
          0,
          startingWeight - weight
        ).toFixed(1)
      );

      const bmi = calculateBMI(
        weight,
        patient.height_cm
      );

      const { error: injectionError } =
        await supabase
          .from("injections")
          .insert({
            patient_id: patient.id,
            injection_date: new Date()
              .toISOString()
              .split("T")[0],
            weight,
            dose: patient.current_dose,
            pen_number: currentPenNumber,
            dose_number: currentDoseNumber,
            notes: notes.trim() || null,
          });

      if (injectionError) {
        throw injectionError;
      }

      const { error: patientUpdateError } =
        await supabase
          .from("patients")
          .update({
            current_weight: weight,
            weight_lost: weightLost,
            bmi,
            dose_number: nextDoseNumber,
            pen_number: nextPenNumber,
          })
          .eq("id", patient.id);

      if (patientUpdateError) {
        throw patientUpdateError;
      }

      setMessage(
        "Injection and weight updated successfully."
      );

      setNotes("");

      await loadPatient();
    } catch (error) {
      console.error(
        "Injection update error:",
        error
      );

      const updateMessage =
        error instanceof Error
          ? error.message
          : "Unable to record the injection.";

      setErrorMessage(updateMessage);
    } finally {
      setSavingInjection(false);
    }
  }

  async function confirmDoseChange() {
    if (!patient || !newDose || savingDose) {
      return;
    }

    setMessage("");
    setErrorMessage("");

    if (newDose === patient.current_dose) {
      setErrorMessage(
        "Please select a different dose before confirming."
      );
      return;
    }

    setSavingDose(true);

    try {
      const { error: doseLogError } =
        await supabase
          .from("dose_changes")
          .insert({
            patient_id: patient.id,
            old_dose: patient.current_dose,
            new_dose: newDose,
            status: "approved",
            notes:
              "Dose changed from patient profile",
          });

      if (doseLogError) {
        throw doseLogError;
      }

      const { error: patientUpdateError } =
        await supabase
          .from("patients")
          .update({
            current_dose: newDose,
          })
          .eq("id", patient.id);

      if (patientUpdateError) {
        throw patientUpdateError;
      }

      setMessage("Dose updated successfully.");

      await loadPatient();
    } catch (error) {
      console.error("Dose update error:", error);

      const updateMessage =
        error instanceof Error
          ? error.message
          : "Unable to update the dose.";

      setErrorMessage(updateMessage);
    } finally {
      setSavingDose(false);
    }
  }

  if (loading) {
    return (
      <main
        style={{
          padding: 30,
          fontFamily: "Arial, sans-serif",
        }}
      >
        Loading patient...
      </main>
    );
  }

  if (!patient) {
    return (
      <main
        style={{
          padding: 30,
          fontFamily: "Arial, sans-serif",
        }}
      >
        <p>Patient not found.</p>

        {errorMessage && (
          <p style={{ color: "#b91c1c" }}>
            {errorMessage}
          </p>
        )}

        <Link href="/dosetrack">
          ← Back to Dashboard
        </Link>
      </main>
    );
  }

  const currentWeightValue = Number(
    patient.current_weight ??
      patient.starting_weight ??
      0
  );

  const startingWeightValue = Number(
    patient.starting_weight ?? 0
  );

  const calculatedBmi = calculateBMI(
    currentWeightValue,
    patient.height_cm
  );

  const calculatedWeightLost =
    startingWeightValue > 0 &&
    currentWeightValue > 0
      ? Number(
          Math.max(
            0,
            startingWeightValue -
              currentWeightValue
          ).toFixed(1)
        )
      : 0;

  const age = calculateAge(patient.dob);

  const dobAndAge = patient.dob
    ? `${patient.dob}${
        age !== null ? ` / ${age} years` : ""
      }`
    : "-";

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 30,
        fontFamily: "Arial, sans-serif",
        background: "#f8fafc",
      }}
    >
      <Link href="/dosetrack">
        ← Back to Dashboard
      </Link>

      <div
        style={{
          marginTop: 20,
          padding: 30,
          borderRadius: 20,
          color: "white",
          background:
            "linear-gradient(135deg, #0f766e, #2563eb)",
        }}
      >
        <h1 style={{ marginTop: 0 }}>
          {patient.first_name} {patient.surname}
        </h1>

        <p style={{ marginBottom: 0 }}>
          {patient.current_dose ||
            "Dose not set"}{" "}
          | Pen {patient.pen_number || 1} |
          Dose {patient.dose_number || 1} of 6
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

      {errorMessage && (
        <div
          style={{
            marginTop: 20,
            padding: 15,
            borderRadius: 12,
            background: "#fee2e2",
            color: "#b91c1c",
          }}
        >
          {errorMessage}
        </div>
      )}

      <section
        style={{
          marginTop: 25,
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        <Info
          title="Patient Clinic ID"
          value={patient.id}
        />

        <Info
          title="ID / Passport"
          value={patient.id_number}
        />

        <Info
          title="Mobile"
          value={patient.mobile_number}
        />

        <Info
          title="DOB / Age"
          value={dobAndAge}
        />

        <Info
          title="Gender"
          value={patient.gender}
        />

        <Info
          title="Country"
          value={patient.country}
        />

        <Info
          title="Height"
          value={
            patient.height_cm
              ? `${patient.height_cm} cm`
              : "-"
          }
        />

        <Info
          title="Starting Weight"
          value={
            patient.starting_weight
              ? `${patient.starting_weight} kg`
              : "-"
          }
        />

        <Info
          title="Current Weight"
          value={
            patient.current_weight
              ? `${patient.current_weight} kg`
              : "-"
          }
        />

        <Info
          title="Weight Lost"
          value={`${calculatedWeightLost} kg`}
        />

        <Info
          title="BMI"
          value={
            calculatedBmi > 0
              ? calculatedBmi.toFixed(1)
              : "-"
          }
        />

        <Info
          title="Next Appointment"
          value="-"
        />

        <Info
          title="Pen Number"
          value={`Pen ${patient.pen_number || 1}`}
        />

        <Info
          title="Dose Number"
          value={`Dose ${
            patient.dose_number || 1
          } of 6`}
        />

        <Info
          title="Status"
          value={patient.status}
        />
      </section>

      <section
        style={{
          marginTop: 30,
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 24,
        }}
      >
        <div style={card}>
          <h2>Record Today’s Injection</h2>

          <p>
            Use this after the patient receives
            their weekly injection. This updates
            weight, BMI, weight loss, dose number
            and pen usage.
          </p>

          <label htmlFor="current-weight">
            Current Weight Today (kg)
          </label>

          <input
            id="current-weight"
            type="number"
            min="1"
            step="0.1"
            value={currentWeight}
            onChange={(event) =>
              setCurrentWeight(
                event.target.value
              )
            }
            style={input}
            placeholder="Enter current weight"
          />

          <label htmlFor="injection-notes">
            Notes
          </label>

          <textarea
            id="injection-notes"
            value={notes}
            onChange={(event) =>
              setNotes(event.target.value)
            }
            style={{
              ...input,
              height: 90,
              resize: "vertical",
            }}
            placeholder="Optional notes"
          />

          <button
            type="button"
            onClick={recordInjection}
            disabled={savingInjection}
            style={{
              ...greenButton,
              opacity: savingInjection
                ? 0.65
                : 1,
            }}
          >
            {savingInjection
              ? "Saving..."
              : "Record Injection Given Today"}
          </button>
        </div>

        <div style={card}>
          <h2>Change Dose</h2>

          <p>
            Use this only when the doctor changes
            the patient’s prescribed dose. The
            change is logged for audit and monthly
            reporting.
          </p>

          <label htmlFor="new-dose">
            New Dose
          </label>

          <select
            id="new-dose"
            value={newDose}
            onChange={(event) =>
              setNewDose(event.target.value)
            }
            style={input}
          >
            <option value="">
              Select New Dose
            </option>

            {doseOptions.map((dose) => (
              <option key={dose} value={dose}>
                {dose}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={confirmDoseChange}
            disabled={savingDose || !newDose}
            style={{
              ...blueButton,
              opacity:
                savingDose || !newDose
                  ? 0.65
                  : 1,
            }}
          >
            {savingDose
              ? "Updating..."
              : "Confirm Dose Change"}
          </button>
        </div>
      </section>
    </main>
  );
}

function Info({
  title,
  value,
}: {
  title: string;
  value:
    | string
    | number
    | null
    | undefined;
}) {
  const displayValue =
    value === null ||
    value === undefined ||
    value === ""
      ? "-"
      : value;

  return (
    <div
      style={{
        background: "white",
        padding: 20,
        borderRadius: 16,
        boxShadow:
          "0 4px 12px rgba(0,0,0,0.06)",
      }}
    >
      <h3
        style={{
          marginTop: 0,
          marginBottom: 8,
        }}
      >
        {title}
      </h3>

      <p
        style={{
          margin: 0,
          overflowWrap: "anywhere",
        }}
      >
        {displayValue}
      </p>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "white",
  padding: 24,
  borderRadius: 18,
  boxShadow:
    "0 4px 16px rgba(0,0,0,0.08)",
};

const input: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: 14,
  marginTop: 8,
  marginBottom: 16,
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  fontSize: 16,
};

const greenButton: React.CSSProperties = {
  width: "100%",
  padding: 14,
  border: "none",
  borderRadius: 12,
  background: "#0f766e",
  color: "white",
  fontWeight: "bold",
  fontSize: 15,
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
  fontSize: 15,
  cursor: "pointer",
};
