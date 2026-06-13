"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AddPatientPage() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [gender, setGender] = useState("");
  const [country, setCountry] = useState("");
  const [doctor, setDoctor] = useState("");
  const [clinicSite, setClinicSite] = useState("");
  const [medication, setMedication] = useState("Mounjaro");
  const [currentDose, setCurrentDose] = useState("");
  const [loading, setLoading] = useState(false);

  async function savePatient() {
    if (!firstName || !surname || !idNumber || !mobileNumber) {
      alert("Please complete first name, surname, ID number and mobile number.");
      return;
    }

    if (!gender || !country || !doctor || !clinicSite || !currentDose) {
      alert("Please select gender, country, doctor, clinic site and current dose.");
      return;
    }

    try {
      setLoading(true);

      const patientClinicId = "PT-" + Date.now();

      const { data, error } = await supabase
        .from("patients")
        .insert([
          {
            patient_clinic_id: patientClinicId,
            first_name: firstName,
            surname,
            id_number: idNumber,
            mobile_number: mobileNumber,
            gender,
            country,
            doctor,
            clinic_site: clinicSite,
            medication,
            current_dose: currentDose,
            status: "active",
          },
        ])
        .select()
        .single();

      if (error) {
        alert(error.message);
        return;
      }

      if (!data?.id) {
        alert("Patient saved, but no patient ID was returned.");
        return;
      }

      router.push(`/dosetrack/patient/${data.id}`);
    } catch (err) {
      console.error(err);
      alert("Failed to save patient.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Add Patient</h1>

      <div style={{ display: "grid", gap: 12, maxWidth: 700, marginTop: 20 }}>
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

        <select value={gender} onChange={(e) => setGender(e.target.value)}>
          <option value="">Select Gender</option>
          <option>Female</option>
          <option>Male</option>
        </select>

        <select value={country} onChange={(e) => setCountry(e.target.value)}>
          <option value="">Select Country</option>
          <option>England</option>
          <option>New Zealand</option>
          <option>Scotland</option>
          <option>South Africa</option>
          <option>Wales</option>
        </select>

        <select value={doctor} onChange={(e) => setDoctor(e.target.value)}>
          <option value="">Select Doctor</option>
          <option>Dr Khumalo</option>
          <option>Dr Jemma Salvage</option>
          <option>Dr Chika</option>
          <option>Dr Yusra Khan</option>
          <option>Dr Ayesha Cassiem</option>
        </select>

        <select value={clinicSite} onChange={(e) => setClinicSite(e.target.value)}>
          <option value="">Select Clinic Site</option>
          <option>Authentic Aesthetics</option>
          <option>Palmyra Pharmacy</option>
          <option>Medirite Langverwacht</option>
          <option>Medirite St Johns</option>
          <option>Medirite Dasport</option>
          <option>Medirite Olivedale</option>
        </select>

        <select value={medication} onChange={(e) => setMedication(e.target.value)}>
          <option>Mounjaro</option>
          <option>Wegovy</option>
          <option>Ozempic</option>
        </select>

        <select value={currentDose} onChange={(e) => setCurrentDose(e.target.value)}>
          <option value="">Select Current Dose</option>
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
          onClick={savePatient}
          disabled={loading}
          style={{
            padding: 12,
            background: "#000",
            color: "#fff",
            border: "none",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Saving..." : "Save Patient"}
        </button>
      </div>
    </main>
  );
}
