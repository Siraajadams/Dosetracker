"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const doctors = ["Dr Khumalo", "Dr Jemma Salvage", "Dr Chika", "Dr Yusra Khan", "Dr Ayesha Cassiem"];

const sites = [
  "Authentic Aesthetics",
  "Palmyra Pharmacy",
  "Medirite Langverwacht",
  "Medirite St Johns",
  "Medirite Dasport",
  "Medirite Olivedale",
];

const countries = ["England", "New Zealand", "Scotland", "South Africa", "Wales"];
const doses = ["10mg", "7.5mg", "5mg", "3.75mg", "2.5mg", "1mg", "0.5mg", "0.25mg"];

export default function AddPatientPage() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [gender, setGender] = useState("");
  const [country, setCountry] = useState("");
  const [doctor, setDoctor] = useState("");
  const [clinicSite, setClinicSite] = useState("");
  const [medication, setMedication] = useState("Mounjaro");
  const [currentDose, setCurrentDose] = useState("");
  const [loading, setLoading] = useState(false);

  function calculateAge(dob: string) {
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();

    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    return age;
  }

  async function savePatient() {
    if (!firstName || !surname || !idNumber || !dateOfBirth || !mobileNumber) {
      alert("Please complete first name, surname, ID/passport, date of birth and mobile number.");
      return;
    }

    if (!gender || !country || !doctor || !clinicSite || !currentDose) {
      alert("Please select gender, country, doctor, clinic site and current dose.");
      return;
    }

    setLoading(true);

    const patientClinicId = "PT-" + Date.now();
    const age = calculateAge(dateOfBirth);

    const { data, error } = await supabase
      .from("patients")
      .insert([
        {
          patient_clinic_id: patientClinicId,
          first_name: firstName,
          surname,
          id_number: idNumber,
          date_of_birth: dateOfBirth,
          age,
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
      .select("id")
      .single();

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    router.push(`/dosetrack/patient/${data.id}`);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 24,
        background: "linear-gradient(135deg, #eef7ff, #f8fafc)",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <section
        style={{
          background: "linear-gradient(135deg, #0f766e, #2563eb)",
          color: "white",
          padding: 28,
          borderRadius: 18,
          marginBottom: 24,
        }}
      >
        <h1 style={{ margin: 0 }}>Add New Patient</h1>
        <p>Create a patient profile for weekly GLP-1 injection scheduling.</p>
      </section>

      <section
        style={{
          background: "white",
          padding: 24,
          borderRadius: 16,
          maxWidth: 850,
          boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
        }}
      >
        <h2>Patient Details</h2>

        <div style={{ display: "grid", gap: 14 }}>
          <input placeholder="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={inputStyle} />

          <input placeholder="Surname" value={surname} onChange={(e) => setSurname(e.target.value)} style={inputStyle} />

          <input placeholder="ID Number / Passport Number" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} style={inputStyle} />

          <label>
            Date of Birth
            <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} style={inputStyle} />
          </label>

          {dateOfBirth && (
            <div style={infoBox}>
              Calculated Age: <strong>{calculateAge(dateOfBirth)}</strong>
            </div>
          )}

          <input placeholder="Mobile Number" value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} style={inputStyle} />

          <select value={gender} onChange={(e) => setGender(e.target.value)} style={inputStyle}>
            <option value="">Select Gender</option>
            <option>Female</option>
            <option>Male</option>
          </select>

          <select value={country} onChange={(e) => setCountry(e.target.value)} style={inputStyle}>
            <option value="">Select Country</option>
            {countries.map((c) => <option key={c}>{c}</option>)}
          </select>

          <select value={doctor} onChange={(e) => setDoctor(e.target.value)} style={inputStyle}>
            <option value="">Select Doctor</option>
            {doctors.map((d) => <option key={d}>{d}</option>)}
          </select>

          <select value={clinicSite} onChange={(e) => setClinicSite(e.target.value)} style={inputStyle}>
            <option value="">Select Clinic Site</option>
            {sites.map((s) => <option key={s}>{s}</option>)}
          </select>

          <select value={medication} onChange={(e) => setMedication(e.target.value)} style={inputStyle}>
            <option>Mounjaro</option>
            <option>Wegovy</option>
            <option>Ozempic</option>
          </select>

          <select value={currentDose} onChange={(e) => setCurrentDose(e.target.value)} style={inputStyle}>
            <option value="">Select Current Dose</option>
            {doses.map((d) => <option key={d}>{d}</option>)}
          </select>

          <button
            onClick={savePatient}
            disabled={loading}
            style={{
              padding: 14,
              borderRadius: 10,
              border: "none",
              background: "#0f766e",
              color: "white",
              fontWeight: "bold",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Saving Patient..." : "Save Patient and Open Profile"}
          </button>
        </div>
      </section>
    </main>
  );
}

const inputStyle = {
  padding: 13,
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  width: "100%",
};

const infoBox = {
  background: "#ecfdf5",
  border: "1px solid #bbf7d0",
  padding: 12,
  borderRadius: 10,
};
