
"use client";

import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Site = {
  id: string;
  site_name: string;
};

type DocumentType = "sa_id" | "passport";

type PatientForm = {
  first_name: string;
  surname: string;
  document_type: DocumentType;
  document_number: string;
  date_of_birth: string;
  gender: string;
  mobile_number: string;
  email: string;
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
  mobile_number: "",
  email: "",
  address: "",
  suburb: "",
  city: "",
  province: "",
  postal_code: "",
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: 13,
  borderRadius: 9,
  border: "1px solid #cbd5e1",
  boxSizing: "border-box",
  fontSize: 15,
  background: "white",
};

const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: 7,
  fontWeight: 600,
  color: "#334155",
};

const fieldStyle: CSSProperties = {
  marginBottom: 18,
};

function validSAID(value: string): boolean {
  if (!/^\d{13}$/.test(value)) return false;

  let sum = 0;
  let doubleDigit = false;

  for (let i = value.length - 1; i >= 0; i--) {
    let digit = Number(value[i]);

    if (doubleDigit) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    doubleDigit = !doubleDigit;
  }

  return sum % 10 === 0;
}

function dobFromSAID(value: string): string {
  if (!validSAID(value)) return "";

  const yy = Number(value.slice(0, 2));
  const mm = Number(value.slice(2, 4));
  const dd = Number(value.slice(4, 6));

  const currentYear = new Date().getFullYear();

  let year = 2000 + yy;

  if (year > currentYear) {
    year = 1900 + yy;
  }

  const date = new Date(Date.UTC(year, mm - 1, dd));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== mm - 1 ||
    date.getUTCDate() !== dd ||
    date.getTime() > Date.now()
  ) {
    return "";
  }

  return [
    String(year),
    String(mm).padStart(2, "0"),
    String(dd).padStart(2, "0"),
  ].join("-");
}

export default function NewPatientPage() {
  const router = useRouter();

  const [form, setForm] =
    useState<PatientForm>(initialForm);

  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState("");
  const [nurseId, setNurseId] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  function update<K extends keyof PatientForm>(
    key: K,
    value: PatientForm[K]
  ) {
    setForm(previous => ({
      ...previous,
      [key]: value,
    }));
  }

  function updateDocument(value: string) {
    const number =
      form.document_type === "sa_id"
        ? value.replace(/\D/g, "").slice(0, 13)
        : value.trimStart().toUpperCase();

    const dob =
      form.document_type === "sa_id"
        ? dobFromSAID(number)
        : "";

    setForm(previous => ({
      ...previous,
      document_number: number,
      date_of_birth:
        previous.document_type === "sa_id"
          ? dob
          : previous.date_of_birth,
    }));
  }

  const loadPage = useCallback(async () => {
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
          .select("role,approval_status,is_active")
          .eq("id", userId)
          .maybeSingle();

      if (profileError) throw profileError;

      if (
        !auth.user.email_confirmed_at ||
        profile?.role !== "nurse" ||
        profile.approval_status !== "approved" ||
        profile.is_active !== true
      ) {
        router.replace("/pending-approval");
        return;
      }

      setNurseId(userId);

      const { data: assignments, error: assignmentError } =
        await supabase
          .from("nurse_site_assignments")
          .select("site_id")
          .eq("nurse_id", userId);

      if (assignmentError) throw assignmentError;

      const ids = [
        ...new Set(
          (assignments || []).map(row => row.site_id)
        ),
      ];

      if (ids.length === 0) {
        setMessage(
          "No clinic assigned. Contact your Super Admin."
        );
        setSites([]);
        return;
      }

      const { data: siteRecords, error: sitesError } =
        await supabase
          .from("sites")
          .select("id,site_name")
          .in("id", ids)
          .eq("is_active", true)
          .order("site_name");

      if (sitesError) throw sitesError;

      const activeSites: Site[] = siteRecords || [];

      setSites(activeSites);

      if (activeSites.length === 1) {
        setSiteId(activeSites[0].id);
      }

      if (activeSites.length === 0) {
        setMessage(
          "No active clinic is available for your account."
        );
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load patient registration."
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  function validate(): string | null {
    if (!siteId) {
      return "Please select a clinic.";
    }

    if (!form.first_name.trim()) {
      return "First name is required.";
    }

    if (!form.surname.trim()) {
      return "Surname is required.";
    }

    if (!form.document_number.trim()) {
      return "ID or passport number is required.";
    }

    if (
      form.document_type === "sa_id" &&
      !dobFromSAID(form.document_number)
    ) {
      return "Enter a valid South African ID number.";
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

    const phone = form.mobile_number.replace(
      /[\s()-]/g,
      ""
    );

    if (!/^(0\d{9}|\+27\d{9})$/.test(phone)) {
      return "Enter a valid South African mobile number.";
    }

    if (
      form.email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
    ) {
      return "Enter a valid email or leave it blank.";
    }

    if (!form.address.trim()) {
      return "Residential address is required.";
    }

    if (!form.city.trim()) {
      return "City or town is required.";
    }

    if (!provinces.includes(form.province)) {
      return "Please select a province.";
    }

    if (!/^\d{4}$/.test(form.postal_code)) {
      return "Postal code must contain 4 digits.";
    }

    return null;
  }

  async function savePatient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) return;

    const validationError = validate();

    if (validationError) {
      setMessage(validationError);
      return;
    }

    setSaving(true);
    setMessage("");
    setSuccess(false);

    try {
      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError || !auth.user) {
        router.replace("/login");
        return;
      }

      if (auth.user.id !== nurseId) {
        throw new Error("Your login session has changed.");
      }

      // Recheck nurse approval.
      const { data: profile, error: profileError } =
        await supabase
          .from("staff_profiles")
          .select("role,approval_status,is_active")
          .eq("id", nurseId)
          .maybeSingle();

      if (profileError) throw profileError;

      if (
        profile?.role !== "nurse" ||
        profile.approval_status !== "approved" ||
        profile.is_active !== true
      ) {
        throw new Error(
          "Your clinical access is not active."
        );
      }

      // Recheck clinic assignment.
      const { data: assignment, error: assignmentError } =
        await supabase
          .from("nurse_site_assignments")
          .select("site_id")
          .eq("nurse_id", nurseId)
          .eq("site_id", siteId)
          .maybeSingle();

      if (assignmentError) throw assignmentError;

      if (!assignment) {
        throw new Error(
          "You are not authorised for this clinic."
        );
      }

      const { data: site, error: siteError } =
        await supabase
          .from("sites")
          .select("id")
          .eq("id", siteId)
          .eq("is_active", true)
          .maybeSingle();

      if (siteError) throw siteError;

      if (!site) {
        throw new Error(
          "The selected clinic is no longer active."
        );
      }

      const documentNumber =
        form.document_number.trim().toUpperCase();

      const lookupColumn =
        form.document_type === "sa_id"
          ? "id_number"
          : "passport_number";

      // Check for existing patient.
      const { data: existing, error: lookupError } =
        await supabase
          .from("patients")
          .select("id")
          .eq(lookupColumn, documentNumber)
          .limit(1);

      if (lookupError) throw lookupError;

      if (existing && existing.length > 0) {
        throw new Error(
          "This patient is already registered. Use Find Patient."
        );
      }

      // Save into the existing patients table.
      const payload = {
        site_id: siteId,
        first_name: form.first_name.trim(),
        surname: form.surname.trim(),

        id_number:
          form.document_type === "sa_id"
            ? documentNumber
            : null,

        passport_number:
          form.document_type === "passport"
            ? documentNumber
            : null,

        date_of_birth: form.date_of_birth,
        gender: form.gender,
        mobile_number: form.mobile_number.replace(
          /[\s()-]/g,
          ""
        ),

        email: form.email.trim() || null,
        address: form.address.trim(),
        suburb: form.suburb.trim() || null,
        city: form.city.trim(),
        province: form.province,
        postal_code: form.postal_code.trim(),
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
            "This patient already exists."
          );
        }

        throw insertError;
      }

      if (!patient?.id) {
        throw new Error(
          "Unable to confirm patient registration."
        );
      }

      setSuccess(true);
      setMessage("Patient registered successfully.");

      // Dashboard already exists and works.
      // Return there after saving rather than
      // redirecting to a patient profile route
      // that may not yet exist.
      setTimeout(() => {
        router.replace("/nurse/dashboard");
      }, 1200);
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
        minHeight: "100vh",
        background: "#f0f7f7",
        padding: "30px 16px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 780,
          margin: "0 auto",
          background: "white",
          borderRadius: 16,
          padding: 28,
          boxShadow: "0 5px 22px rgba(0,0,0,0.06)",
        }}
      >
        <h1 style={{ color: "#075c59" }}>
          DoseTrack — Add Patient
        </h1>

        <p style={{ color: "#64748b" }}>
          Family Planning | Patient Registration
        </p>

        {message && (
          <p
            role={success ? "status" : "alert"}
            style={{
              padding: 14,
              borderRadius: 9,
              background: success
                ? "#dcfce7"
                : "#fff7ed",
              color: success
                ? "#166534"
                : "#9a3412",
            }}
          >
            {message}
          </p>
        )}

        <form onSubmit={savePatient}>
          <div style={fieldStyle}>
            <label htmlFor="site" style={labelStyle}>
              Select Clinic *
            </label>

            <select
              id="site"
              value={siteId}
              onChange={e => setSiteId(e.target.value)}
              style={inputStyle}
              required
            >
              <option value="">Select Clinic</option>

              {sites.map(site => (
                <option key={site.id} value={site.id}>
                  {site.site_name}
                </option>
              ))}
            </select>
          </div>

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
              onChange={e =>
                setForm(previous => ({
                  ...previous,
                  document_type:
                    e.target.value as DocumentType,
                  document_number: "",
                  date_of_birth: "",
                }))
              }
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
                updateDocument(e.target.value)
              }
              inputMode={
                form.document_type === "sa_id"
                  ? "numeric"
                  : "text"
              }
              maxLength={
                form.document_type === "sa_id"
                  ? 13
                  : 40
              }
              autoComplete="off"
              style={inputStyle}
              required
            />

            {form.document_type === "sa_id" && (
              <small style={{ color: "#64748b" }}>
                Date of birth is automatically populated
                when a valid SA ID is entered.
              </small>
            )}
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
              readOnly={
                form.document_type === "sa_id"
              }
              style={{
                ...inputStyle,
                background:
                  form.document_type === "sa_id"
                    ? "#f1f5f9"
                    : "white",
              }}
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
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <h2>Contact Details</h2>

          <div style={fieldStyle}>
            <label htmlFor="mobile" style={labelStyle}>
              Contact Number *
            </label>

            <input
              id="mobile"
              type="tel"
              value={form.mobile_number}
              onChange={e =>
                update("mobile_number", e.target.value)
              }
              placeholder="082 123 4567"
              style={inputStyle}
              required
            />
          </div>

          <div style={fieldStyle}>
            <label htmlFor="email" style={labelStyle}>
              Email Address (Optional)
            </label>

            <input
              id="email"
              type="email"
              value={form.email}
              onChange={e =>
                update("email", e.target.value)
              }
              placeholder="patient@example.com"
              style={inputStyle}
            />
          </div>

          <h2>Residential Address</h2>

          <div style={fieldStyle}>
            <label htmlFor="address" style={labelStyle}>
              Street Address *
            </label>

            <textarea
              id="address"
              rows={3}
              value={form.address}
              onChange={e =>
                update("address", e.target.value)
              }
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
                update(
                  "postal_code",
                  e.target.value.replace(/\D/g, "")
                )
              }
              maxLength={4}
              inputMode="numeric"
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
              disabled={
                saving ||
                success ||
                sites.length === 0
              }
              style={{
                padding: "14px 22px",
                background: "#0f766e",
                color: "white",
                border: "none",
                borderRadius: 9,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {saving
                ? "Saving Patient..."
                : success
                  ? "Patient Saved"
                  : "Register Patient"}
            </button>

            <button
              type="button"
              onClick={() =>
                router.push("/nurse/dashboard")
              }
              style={{
                padding: "14px 22px",
                borderRadius: 9,
                cursor: "pointer",
              }}
            >
              Back to Dashboard
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
