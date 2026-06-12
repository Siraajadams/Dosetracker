"use client";

import { useState } from "react";

export default function AddPatientPage() {
  const [patient, setPatient] = useState({
    firstName: "",
    surname: "",
    idNumber: "",
    mobile: "",
    doctor: "",
    site: "",
    medication: "",
    currentDose: "",
  });

  return (
    <main style={{ padding: 24 }}>
      <h1>Add Patient</h1>

      <div
        style={{
          display: "grid",
          gap: 12,
          maxWidth: 600,
        }}
      >
        <input
          placeholder="First Name"
          value={patient.firstName}
          onChange={(e) =>
            setPatient({ ...patient, firstName: e.target.value })
          }
        />

        <input
          placeholder="Surname"
          value={patient.surname}
          onChange={(e) =>
            setPatient({ ...patient, surname: e.target.value })
          }
        />

        <input
          placeholder="ID Number / Passport Number"
          value={patient.idNumber}
          onChange={(e) =>
            setPatient({ ...patient, idNumber: e.target.value })
          }
        />

        <input
          placeholder="Mobile Number"
          value={patient.mobile}
          onChange={(e) =>
            setPatient({ ...patient, mobile: e.target.value })
          }
        />

        <input
          placeholder="Doctor"
          value={patient.doctor}
          onChange={(e) =>
            setPatient({ ...patient, doctor: e.target.value })
          }
        />

        <input
          placeholder="Clinic Site"
          value={patient.site}
          onChange={(e) =>
            setPatient({ ...patient, site: e.target.value })
          }
        />

        <select
          value={patient.medication}
          onChange={(e) =>
            setPatient({ ...patient, medication: e.target.value })
          }
        >
          <option value="">Select Medication</option>
          <option value="Wegovy">Wegovy</option>
          <option value="Mounjaro">Mounjaro</option>
          <option value="Ozempic">Ozempic</option>
        </select>

        <input
          placeholder="Current Dose"
          value={patient.currentDose}
          onChange={(e) =>
            setPatient({ ...patient, currentDose: e.target.value })
          }
        />

        <button
          style={{
            padding: 12,
            background: "#000",
            color: "#fff",
            border: "none",
            cursor: "pointer",
          }}
        >
          Save Patient
        </button>
      </div>
    </main>
  );
}
