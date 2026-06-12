"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AddPatientPage() {
  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [doctor, setDoctor] = useState("");
  const [clinicSite, setClinicSite] = useState("");
  const [medication, setMedication] = useState("Mounjaro");
  const [currentDose, setCurrentDose] = useState("");
  const [loading, setLoading] = useState(false);

  async function savePatient() {
    try {
      setLoading(true);

      const patientClinicId =
        "PT-" + Math.floor(Math.random() * 1000000);

      const { error } = await supabase
        .from("patients")
        .insert([
          {
            patient_clinic_id: patientClinicId,
            first_name: firstName,
            surname,
            id_number: idNumber,
            mobile_number: mobileNumber,
            doctor,
            clinic_site: clinicSite,
            medication,
            current_dose: currentDose,
            status: "Active",
          },
        ]);

      if (error) {
        alert(error.message);
        return;
      }

      alert("Patient Saved Successfully");

      setFirstName("");
      setSurname("");
      setIdNumber("");
      setMobileNumber("");
      setDoctor("");
      setClinicSite("");
      setMedication("Mounjaro");
      setCurrentDose("");
    } catch (err) {
      console.error(err);
      alert("Failed to save patient");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Add Patient</h1>

      <div
        style={{
          display: "grid",
          gap: 12,
          maxWidth: 700,
          marginTop: 20,
        }}
      >
        <input
          placeholder="First Name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
        />

        <input
          placeholder="Surname"
          value={surname}
          onChange={(e) => setSurname(e.target.value)}
        />

        <input
          placeholder="ID Number / Passport Number"
          value={idNumber}
          onChange={(e) => setIdNumber(e.target.value)}
        />

        <input
          placeholder="Mobile Number"
          value={mobileNumber}
          onChange={(e) => setMobileNumber(e.target.value)}
        />

        <select
          value={doctor}
          onChange={(e) => setDoctor(e.target.value)}
        >
          <option value="">Select Doctor</option>
          <option>Dr Khumalo</option>
          <option>Dr Jemma Salvage</option>
          <option>Dr Chika</option>
          <option>Dr Yusra Khan</option>
          <option>Dr Ayesha Cassiem</option>
        </select>

        <select
          value={clinicSite}
          onChange={(e) => setClinicSite(e.target.value)}
        >
          <option value="">Select Clinic Site</option>
          <option>Authentic Aesthetics</option>
          <option>Palmyra Pharmacy</option>
          <option>Medirite Langverwacht</option>
          <option>Medirite St Johns</option>
          <option>Medirite Dasport</option>
          <option>Medirite Olivedale</option>
        </select>

        <select
          value={medication}
          onChange={(e) => setMedication(e.target.value)}
        >
          <option>Mounjaro</option>
          <option>Wegovy</option>
          <option>Ozempic</option>
        </select>

        <input
          placeholder="Current Dose"
          value={currentDose}
          onChange={(e) => setCurrentDose(e.target.value)}
        />

        <button
          onClick={savePatient}
          disabled={loading}
          style={{
            padding: 12,
            background: "#000",
            color: "#fff",
            border: "none",
            cursor: "pointer",
          }}
        >
          {loading ? "Saving..." : "Save Patient"}
        </button>
      </div>
    </main>
  );
}
