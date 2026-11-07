
"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Clinic = {
  id: string;
  name: string;
};

type DocumentType = "sa_id" | "passport";

type PatientForm = {
  first_name: string;
  surname: string;
  document_type: DocumentType;
  document_number: string;
  date_of_birth: string;
  gender: string;
  contact_number: string;
  address: string;
  suburb: string;
  city: string;
  province: string;
  postal_code: string;
};

const provinces = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "North West",
  "Northern Cape",
  "Western Cape",
];

const initialForm: PatientForm = {
  first_name: "",
  surname: "",
  document_type: "sa_id",
  document_number: "",
  date_of_birth: "",
  gender: "",
  contact_number: "",
  address: "",
  suburb: "",
  city: "",
  province: "",
  postal_code: "",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 12,
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  boxSizing: "border-box",
  fontSize: 15,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 6,
  fontWeight: 600,
};

const fieldStyle: React.CSSProperties = {
  marginBottom: 18,
};

export default function AddPatientPage() {
  const router = useRouter();

  const [form, setForm] =
    useState<PatientForm>(initialForm);

  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [clinicId, setClinicId] = useState("");
  const [nurseId, setNurseId] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function update<K extends keyof PatientForm>(
    field: K,
    value: PatientForm[K]
  ) {
    setForm(prev => ({
      ...prev,
      [field]: value,
    }));
  }

  const initialize = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError || !auth.user) {
        router.replace("/login");
        return;
      }

      const userId = auth.user.id;

      const { data: profile, error: profileError } =
        await supabase
          .from("staff_profiles")
          .select("role, approval_status, is_active")
          .eq("id", userId)
          .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (!profile) {
        throw new Error("Staff profile not found.");
      }

      if (
        profile.approval_status !== "approved" ||
        profile.is_active !== true
      ) {
        router.replace("/pending-approval");
        return;
      }

      if (profile.role !== "nurse") {
        throw new Error("Nurse access required.");
      }

      setNurseId(userId);

      // Requires the nurse_clinic_assignments table
      // and an existing relationship with clinics.
      const { data, error } = await supabase
        .from("nurse_clinic_assignments")
        .select("clinic_id, clinics(id, name)")
        .eq("nurse_id", userId);

      if (error) {
        throw error;
      }

      const assignedClinics: Clinic[] = (
        data || []
      ).flatMap(row => {
        const related = row.clinics;

        const clinic = Array.isArray(related)
          ? related[0]
          : related;

        if (!clinic) return [];

        return [
          {
            id: clinic.id,
            name: clinic.name,
          },
        ];
      });

      setClinics(assignedClinics);

      if (assignedClinics.length === 1) {
        setClinicId(assignedClinics[0].id);
      }

      if (assignedClinics.length === 0) {
        setMessage(
          "No clinic assigned. Contact your Super Admin."
        );
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load registration."
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  function validate(): string | null {
    if (!clinicId) {
      return "Please select a clinic.";
    }

    if (!form.first_name.trim()) {
      return "First name is required.";
    }

    if (!form.surname.trim()) {
      return "Surname is required.";
    }

    const documentNumber =
      form.document_number.trim();

    if (!documentNumber) {
      return "ID or passport number is required.";
    }

    if (
      form.document_type === "sa_id" &&
      !/^\d{13}$/.test(documentNumber)
    ) {
      return "SA ID number must contain 13 digits.";
    }

    if (!form.date_of_birth) {
      return "Date of birth is required.";
    }

    if (
      form.date_of_birth >
      new Date().toISOString().slice(0, 10)
    ) {
      return "Date of birth cannot be in the future.";
    }

    if (!form.gender) {
      return "Please select gender.";
    }

    const phone = form.contact_number.replace(
      /[\s()-]/g,
      ""
    );

    if (!/^(0\d{9}|\+27\d{9})$/.test(phone)) {
      return "Enter a valid South African contact number.";
    }

    if (!form.address.trim()) {
      return "Residential address is required.";
    }

    if (!form.city.trim()) {
      return "City or town is required.";
    }

    if (!provinces.includes(form.province)) {
      return "Please select a valid province.";
    }

    if (!/^\d{4}$/.test(form.postal_code)) {
      return "Postal code must contain 4 digits.";
    }

    return null;
  }

  async function savePatient(event: FormEvent) {
    event.preventDefault();

    if (saving) return;

    const validationError = validate();

    if (validationError) {
      setMessage(validationError);
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError || !auth.user) {
        router.replace("/login");
        return;
      }

      if (auth.user.id !== nurseId) {
        throw new Error("Session has changed.");
      }

      // Recheck the clinic assignment before saving.
      const { data: assignment, error: assignmentError } =
        await supabase
          .from("nurse_clinic_assignments")
          .select("clinic_id")
          .eq("nurse_id", auth.user.id)
          .eq("clinic_id", clinicId)
          .maybeSingle();

      if (assignmentError || !assignment) {
        throw new Error(
          "You are not authorised for this clinic."
        );
      }

      const documentNumber =
        form.document_number.trim().toUpperCase();

      // Duplicate lookup. A database uniqueness
      // constraint is also required to prevent races.
      const { data: existing, error: lookupError } =
        await supabase
          .from("patients")
          .select("id")
          .eq("document_type", form.document_type)
          .eq("document_number", documentNumber)
          .limit(1);

      if (lookupError) {
        throw lookupError;
      }

      if (existing && existing.length > 0) {
        setMessage(
          "A patient with this identification number already exists. Use Find Patient."
        );
        return;
      }

      const payload = {
        clinic_id: clinicId,
        first_name: form.first_name.trim(),
        surname: form.surname.trim(),
        document_type: form.document_type,
        document_number: documentNumber,
        date_of_birth: form.date_of_birth,
        gender: form.gender,
        contact_number: form.contact_number.trim(),
        address: form.address.trim(),
        suburb: form.suburb.trim(),
        city: form.city.trim(),
        province: form.province,
        postal_code: form.postal_code.trim(),
        created_by: nurseId,
      };

      const { data: patient, error: insertError } =
        await supabase
          .from("patients")
          .insert(payload)
          .select("id")
          .single();

      if (insertError) {
        if (insertError.code === "23505") {
          throw new Error(
            "Patient already registered. Use Find Patient."
          );
        }

        throw insertError;
      }

      router.replace(
        `/nurse/patients/${encodeURIComponent(patient.id)}`
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to register patient."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        Loading patient registration...
      </main>
    );
  }

  return (
    <main
      style={{
        maxWidth: 760,
        margin: "32px auto",
        padding: 24,
        background: "#f8fafc",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1>DoseTrack — Add Patient</h1>
      <p>Family Planning | Patient Registration</p>

      {message && (
        <p
          role="status"
          style={{
            padding: 12,
            background: "#fff7ed",
            borderRadius: 8,
          }}
        >
          {message}
        </p>
      )}

      <form onSubmit={savePatient}>
        <section style={fieldStyle}>
          <label htmlFor="clinic" style={labelStyle}>
            Select Clinic *
          </label>

          <select
            id="clinic"
            value={clinicId}
            onChange={e => setClinicId(e.target.value)}
            style={inputStyle}
            required
          >
            <option value="">Select Clinic</option>

            {clinics.map(clinic => (
              <option
                key={clinic.id}
                value={clinic.id}
              >
                {clinic.name}
              </option>
            ))}
          </select>
        </section>

        <h2>Personal Information</h2>

        <div style={fieldStyle}>
          <label htmlFor="firstName" style={labelStyle}>
            First Name *
          </label>

          <input
            id="firstName"
            value={form.first_name}
            onChange={e =>
              update("first_name", e.target.value)
            }
            style={inputStyle}
            required
          />
        </div>

        <div style={fieldStyle}>
          <label htmlFor="surname" style={labelStyle}>
            Surname *
          </label>

          <input
            id="surname"
            value={form.surname}
            onChange={e =>
              update("surname", e.target.value)
            }
            style={inputStyle}
            required
          />
        </div>

        <div style={fieldStyle}>
          <label htmlFor="documentType" style={labelStyle}>
            Identification Type *
          </label>

          <select
            id="documentType"
            value={form.document_type}
            onChange={e => {
              update(
                "document_type",
                e.target.value as DocumentType
              );
              update("document_number", "");
            }}
            style={inputStyle}
          >
            <option value="sa_id">
              South African ID
            </option>
            <option value="passport">
              Passport
            </option>
          </select>
        </div>

        <div style={fieldStyle}>
          <label htmlFor="documentNumber" style={labelStyle}>
            ID / Passport Number *
          </label>

          <input
            id="documentNumber"
            value={form.document_number}
            onChange={e =>
              update("document_number", e.target.value)
            }
            style={inputStyle}
            required
          />
        </div>

        <div style={fieldStyle}>
          <label htmlFor="dob" style={labelStyle}>
            Date of Birth *
          </label>

          <input
            id="dob"
            type="date"
            value={form.date_of_birth}
            onChange={e =>
              update("date_of_birth", e.target.value)
            }
            style={inputStyle}
            required
          />
        </div>

        <div style={fieldStyle}>
          <label htmlFor="gender" style={labelStyle}>
            Gender *
          </label>

          <select
            id="gender"
            value={form.gender}
            onChange={e =>
              update("gender", e.target.value)
            }
            style={inputStyle}
            required
          >
            <option value="">Select Gender</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
          </select>
        </div>

        <h2>Contact Details</h2>

        <div style={fieldStyle}>
          <label htmlFor="contact" style={labelStyle}>
            Contact Number *
          </label>

          <input
            id="contact"
            type="tel"
            value={form.contact_number}
            onChange={e =>
              update("contact_number", e.target.value)
            }
            placeholder="082 123 4567"
            style={inputStyle}
            required
          />
        </div>

        <h2>Residential Address</h2>

        <div style={fieldStyle}>
          <label htmlFor="address" style={labelStyle}>
            Street Address *
          </label>

          <textarea
            id="address"
            value={form.address}
            onChange={e =>
              update("address", e.target.value)
            }
            placeholder="House number and street"
            rows={3}
            style={inputStyle}
            required
          />
        </div>

        <div style={fieldStyle}>
          <label htmlFor="suburb" style={labelStyle}>
            Suburb
          </label>

          <input
            id="suburb"
            value={form.suburb}
            onChange={e =>
              update("suburb", e.target.value)
            }
            style={inputStyle}
          />
        </div>

        <div style={fieldStyle}>
          <label htmlFor="city" style={labelStyle}>
            City / Town *
          </label>

          <input
            id="city"
            value={form.city}
            onChange={e =>
              update("city", e.target.value)
            }
            style={inputStyle}
            required
          />
        </div>

        <div style={fieldStyle}>
          <label htmlFor="province" style={labelStyle}>
            Province *
          </label>

          <select
            id="province"
            value={form.province}
            onChange={e =>
              update("province", e.target.value)
            }
            style={inputStyle}
            required
          >
            <option value="">Select Province</option>

            {provinces.map(province => (
              <option
                key={province}
                value={province}
              >
                {province}
              </option>
            ))}
          </select>
        </div>

        <div style={fieldStyle}>
          <label htmlFor="postalCode" style={labelStyle}>
            Postal Code *
          </label>

          <input
            id="postalCode"
            value={form.postal_code}
            onChange={e =>
              update("postal_code", e.target.value)
            }
            inputMode="numeric"
            maxLength={4}
            placeholder="7700"
            style={inputStyle}
            required
          />
        </div>

        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <button
            type="submit"
            disabled={saving || clinics.length === 0}
            style={{
              padding: "14px 22px",
              background: "#0f766e",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            {saving
              ? "Saving Patient..."
              : "Register Patient"}
          </button>

          <button
            type="button"
            onClick={() =>
              router.push("/nurse/dashboard")
            }
            style={{
              padding: "14px 22px",
              borderRadius: 8,
            }}
          >
            Back to Dashboard
          </button>
        </div>
      </form>
    </main>
  );
}
