"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Patient = {
  id: string;
  patient_clinic_id: string | null;
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
  next_appointment_date: string | null;
  doctor: string | null;
  clinic_site: string | null;
  doctor_id: string | null;
  site_id: string | null;
  status: string | null;
};

type AppointmentRecord = {
  id: string;
  appointment_time: string | null;
  appointment_date: string;
  status: string | null;
  site_id: string | null;
  doctor_id: string | null;
  site: string | null;
  doctor: string | null;
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

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(dateValue: string, numberOfDays: number) {
  const date = new Date(`${dateValue}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Unable to calculate the next appointment date.");
  }

  date.setDate(date.getDate() + numberOfDays);

  return formatLocalDate(date);
}

function parseDoseMg(dose?: string | null) {
  if (!dose) {
    return null;
  }

  const parsedDose = Number.parseFloat(
    String(dose).replace(/[^0-9.]/g, "")
  );

  return Number.isFinite(parsedDose) ? parsedDose : null;
}

function normaliseAppointmentTime(time?: string | null) {
  if (!time) {
    return "09:00:00";
  }

  if (/^\d{2}:\d{2}:\d{2}$/.test(time)) {
    return time;
  }

  if (/^\d{2}:\d{2}$/.test(time)) {
    return `${time}:00`;
  }

  return "09:00:00";
}

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
        patient_clinic_id,
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
        next_appointment_date,
        doctor,
        clinic_site,
        doctor_id,
        site_id,
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

    const birthDate = new Date(`${dob}T12:00:00`);

    if (Number.isNaN(birthDate.getTime())) {
      return null;
    }

    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();

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

  async function findTodaysAppointment(
    patientRecord: Patient,
    today: string
  ): Promise<AppointmentRecord | null> {
    const { data, error } = await supabase
      .from("appointments")
      .select(`
        id,
        appointment_time,
        appointment_date,
        status,
        site_id,
        doctor_id,
        site,
        doctor
      `)
      .eq("patient_id", patientRecord.id)
      .eq("appointment_date", today)
      .order("appointment_time", {
        ascending: true,
      })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Unable to check today's appointment: ${error.message}`
      );
    }

    return (data as AppointmentRecord | null) ?? null;
  }

  async function completeTodaysAppointment(
    appointment: AppointmentRecord | null
  ) {
    if (!appointment) {
      return;
    }

    const { error } = await supabase
      .from("appointments")
      .update({
        status: "completed",
      })
      .eq("id", appointment.id);

    if (error) {
      throw new Error(
        `Injection was recorded, but today's appointment could not be completed: ${error.message}`
      );
    }
  }

  async function createNextAppointment({
    patientRecord,
    todaysAppointment,
    nextAppointmentDate,
    nextDoseNumber,
  }: {
    patientRecord: Patient;
    todaysAppointment: AppointmentRecord | null;
    nextAppointmentDate: string;
    nextDoseNumber: number;
  }) {
    const appointmentTime = normaliseAppointmentTime(
      todaysAppointment?.appointment_time
    );

    const { data: existingAppointment, error: lookupError } =
      await supabase
        .from("appointments")
        .select("id")
        .eq("patient_id", patientRecord.id)
        .eq("appointment_date", nextAppointmentDate)
        .limit(1)
        .maybeSingle();

    if (lookupError) {
      throw new Error(
        `Unable to check the next appointment: ${lookupError.message}`
      );
    }

    if (existingAppointment) {
      return;
    }

    const plannedDoseMg = parseDoseMg(
      patientRecord.current_dose
    );

    const { error: appointmentError } = await supabase
      .from("appointments")
      .insert({
        patient_id: patientRecord.id,

        site_id:
          patientRecord.site_id ||
          todaysAppointment?.site_id ||
          null,

        doctor_id:
          patientRecord.doctor_id ||
          todaysAppointment?.doctor_id ||
          null,

        appointment_date: nextAppointmentDate,
        appointment_time: appointmentTime,

        week_number: nextDoseNumber,
        planned_dose_mg: plannedDoseMg,

        status: "scheduled",
        notes: "Automatically scheduled after recorded injection",

        duration_minutes: 15,

        site:
          patientRecord.clinic_site ||
          todaysAppointment?.site ||
          null,

        doctor:
          patientRecord.doctor ||
          todaysAppointment?.doctor ||
          null,

        pen_dose_number: nextDoseNumber,
        recurring_weekly: true,
        appointment_type: "Injection",
      });

    if (appointmentError) {
      throw new Error(
        `Injection was recorded, but the next appointment could not be created: ${appointmentError.message}`
      );
    }
  }

  async function recordInjection() {
    if (!patient || savingInjection) {
      return;
    }

    setMessage("");
    setErrorMessage("");

    const weight = Number(currentWeight);

    if (!Number.isFinite(weight) || weight <= 0) {
      setErrorMessage(
        "Please enter the patient's current weight."
      );
      return;
    }

    setSavingInjection(true);

    try {
      const today = formatLocalDate(new Date());
      const nextAppointmentDate = addDays(today, 7);

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
        Number(patient.starting_weight || 0) || weight;

      const weightLost = Number(
        Math.max(0, startingWeight - weight).toFixed(1)
      );

      const bmi = calculateBMI(
        weight,
        patient.height_cm
      );

      const todaysAppointment =
        await findTodaysAppointment(patient, today);

      const { error: injectionError } = await supabase
        .from("injections")
        .insert({
          patient_id: patient.id,
          injection_date: today,
          weight,
          dose: patient.current_dose,
          pen_number: currentPenNumber,
          dose_number: currentDoseNumber,
          notes: notes.trim() || null,
        });

      if (injectionError) {
        throw new Error(
          `Unable to save the injection: ${injectionError.message}`
        );
      }

      const { error: patientUpdateError } = await supabase
        .from("patients")
        .update({
          current_weight: weight,
          weight_lost: weightLost,
          bmi,
          dose_number: nextDoseNumber,
          pen_number: nextPenNumber,
          next_appointment_date: nextAppointmentDate,
        })
        .eq("id", patient.id);

      if (patientUpdateError) {
        throw new Error(
          `Injection was saved, but the patient record could not be updated: ${patientUpdateError.message}`
        );
      }

      await completeTodaysAppointment(todaysAppointment);

      await createNextAppointment({
        patientRecord: patient,
        todaysAppointment,
        nextAppointmentDate,
        nextDoseNumber,
      });

      setMessage(
        `Injection recorded successfully. The next appointment was scheduled for ${nextAppointmentDate}.`
      );

      setNotes("");
      await loadPatient();
    } catch (error) {
      console.error("Injection update error:", error);

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
      const { error: doseLogError } = await supabase
        .from("dose_changes")
        .insert({
          patient_id: patient.id,
          old_dose: patient.current_dose,
          new_dose: newDose,
          status: "approved",
          notes: "Dose changed from patient profile",
        });

      if (doseLogError) {
        throw new Error(
          `Unable to save the dose-change history: ${doseLogError.message}`
        );
      }

      const { error: patientUpdateError } = await supabase
        .from("patients")
        .update({
          current_dose: newDose,
        })
        .eq("id", patient.id);

      if (patientUpdateError) {
        throw new Error(
          `Unable to update the patient dose: ${patientUpdateError.message}`
        );
      }

      /*
       * Also update the patient's next scheduled appointment
       * so that the calendar displays the new planned dose.
       */
      const plannedDoseMg = parseDoseMg(newDose);

      const { error: appointmentUpdateError } =
        await supabase
          .from("appointments")
          .update({
            planned_dose_mg: plannedDoseMg,
          })
          .eq("patient_id", patient.id)
          .eq("status", "scheduled")
          .gte(
            "appointment_date",
            formatLocalDate(new Date())
          );

      if (appointmentUpdateError) {
        throw new Error(
          `The patient dose changed, but the next appointment could not be updated: ${appointmentUpdateError.message}`
        );
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
            startingWeightValue - currentWeightValue
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
          {patient.current_dose || "Dose not set"} | Pen{" "}
          {patient.pen_number || 1} | Dose{" "}
          {patient.dose_number || 1} of 6
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
          value={patient.patient_clinic_id || patient.id}
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
          value={patient.next_appointment_date}
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
          title="Doctor"
          value={patient.doctor}
        />

        <Info
          title="Clinic Site"
          value={patient.clinic_site}
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
            Use this after the patient receives their
            weekly injection. This updates weight,
            BMI, weight loss, dose and pen usage,
            completes today’s booking and creates the
            next weekly appointment.
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
              setCurrentWeight(event.target.value)
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
              opacity: savingInjection ? 0.65 : 1,
            }}
          >
            {savingInjection
              ? "Saving and Scheduling..."
              : "Record Injection Given Today"}
          </button>
        </div>

        <div style={card}>
          <h2>Change Dose</h2>

          <p>
            Use this only when the doctor changes the
            patient’s prescribed dose. The change is
            logged for audit and monthly reporting.
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
                savingDose || !newDose ? 0.65 : 1,
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
