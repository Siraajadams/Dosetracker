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
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [country, setCountry] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [startingWeight, setStartingWeight] = useState("");
  const [currentWeight, setCurrentWeight] = useState("");
  const [doctor, setDoctor] = useState("");
  const [clinicSite, setClinicSite] = useState("");
  const [medication, setMedication] = useState("Mounjaro");
  const [currentDose, setCurrentDose] = useState("");
  const [loading, setLoading] = useState(false);

  function calculateAge(dobValue: string) {
    const birthDate = new Date(dobValue);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    return age;
  }

  function calculateBMI(weight: number, height: number) {
    const heightM = height / 100;
    return Number((weight / (heightM * heightM)).toFixed(1));
  }

  async function savePatient() {
    if (
      !firstName ||
      !surname ||
      !idNumber ||
      !mobileNumber ||
      !dob ||
      !gender ||
      !country ||
      !heightCm ||
      !startingWeight ||
      !currentWeight ||
      !doctor ||
      !clinicSite ||
      !currentDose
    ) {
      alert("Please complete all required fields.");
      return;
    }

    try {
      setLoading(true);

      const patientClinicId = "PT-" + Date.now();

      const age = calculateAge(dob);
      const height = Number(heightCm);
      const startWeight = Number(startingWeight);
      const currWeight = Number(currentWeight);
      const bmi = calculateBMI(currWeight, height);
      const weightLost = Number((startWeight - currWeight).toFixed(1));

      const { data, error } = await supabase
        .from("patients")
        .insert([
          {
            patient_clinic_id: patientClinicId,
            first_name: firstName,
            surname,
            id_number: idNumber,
            mobile_number: mobileNumber,
            dob,
            age,
            gender,
            country,
            height_cm: height,
            starting_weight: startWeight,
            current_weight: currWeight,
            weight_lost: weightLost,
            bmi,
            doctor,
            clinic_site: clinicSite,
            medication,
            current_dose: currentDose,
            dose_number: 1,
            pen_number: 1,
            status: "active",
          },
        ])
        .select()
        .single();

      if (error) {
        alert(error.message);
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

  const inputStyle = {
    padding: 12,
    borderRadius: 10,
    border: "1px solid #cbd5e1",
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
      <section
        style={{
          maxWidth: 850,
          background: "white",
          padding: 28,
          borderRadius: 18,
          boxShadow: "0 4px 18px rgba(0,0,0,0.08)",
        }}
      >
        <h1>Add Patient</h1>
        <p>Capture patient profile, dose, weight and clinic details.</p>

        <div style={{ display: "grid", gap: 12, marginTop: 20 }}>
          <input style={inputStyle} placeholder="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <input style={inputStyle} placeholder="Surname" value={surname} onChange={(e) => setSurname(e.target.value)} />
          <input style={inputStyle} placeholder="ID Number / Passport Number" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
          <input style={inputStyle} placeholder="Mobile Number" value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} />

          <label>Date of Birth</label>
          <input style={inputStyle} type="date" value={dob} onChange={(e) => setDob(e.target.value)} />

          <select style={inputStyle} value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="">Select Gender</option>
            <option>Female</option>
            <option>Male</option>
          </select>

          <select style={inputStyle} value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">Select Country</option>
            <option>England</option>
            <option>New Zealand</option>
            <option>Scotland</option>
            <option>South Africa</option>
            <option>Wales</option>
          </select>

          <input style={inputStyle} type="number" placeholder="Height in cm" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
          <input style={inputStyle} type="number" placeholder="Starting Weight kg" value={startingWeight} onChange={(e) => setStartingWeight(e.target.value)} />
          <input style={inputStyle} type="number" placeholder="Current Weight kg" value={currentWeight} onChange={(e) => setCurrentWeight(e.target.value)} />

          <select style={inputStyle} value={doctor} onChange={(e) => setDoctor(e.target.value)}>
            <option value="">Select Doctor</option>
            <option>Dr Khumalo</option>
            <option>Dr Jemma Salvage</option>
            <option>Dr Chika</option>
            <option>Dr Yusra Khan</option>
            <option>Dr Ayesha Cassiem</option>
          </select>

          <select style={inputStyle} value={clinicSite} onChange={(e) => setClinicSite(e.target.value)}>
            <option value="">Select Clinic Site</option>
            <option>Authentic Aesthetics</option>
            <option>Palmyra Pharmacy</option>
            <option>Medirite Langverwacht</option>
            <option>Medirite St Johns</option>
            <option>Medirite Dasport</option>
            <option>Medirite Olivedale</option>
          </select>

          <select style={inputStyle} value={medication} onChange={(e) => setMedication(e.target.value)}>
            <option>Mounjaro</option>
            <option>Wegovy</option>
            <option>Ozempic</option>
          </select>

          <select style={inputStyle} value={currentDose} onChange={(e) => setCurrentDose(e.target.value)}>
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
              padding: 14,
              background: "#0f766e",
              color: "white",
              border: "none",
              borderRadius: 10,
              fontWeight: "bold",
            }}
          >
            {loading ? "Saving..." : "Save Patient & Open Profile"}
          </button>
        </div>
      </section>
    </main>
  );
}
