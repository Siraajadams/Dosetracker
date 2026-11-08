
"use client";

import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Patient = {
  id: string;
  patient_clinic_id: string | null;
  site_id: string | null;
  first_name: string | null;
  surname: string | null;
  id_number: string | null;
  passport_number: string | null;
  date_of_birth: string | null;
  gender: string | null;
  mobile_number: string | null;
  email: string | null;
  address: string | null;
  suburb: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
};

type Site = {
  id: string;
  site_name: string;
};

const card: CSSProperties = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 22,
  marginBottom: 18,
};

const button: CSSProperties = {
  padding: "12px 18px",
  borderRadius: 9,
  border: "none",
  background: "#0f766e",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
};

function display(value: string | null | undefined) {
  return value?.trim() || "Not recorded";
}

function formatDate(value: string | null) {
  if (!value) return "Not recorded";

  const parts = value.split("-");

  if (parts.length !== 3) return value;

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={{ marginBottom: 15 }}>
      <div
        style={{
          color: "#64748b",
          fontSize: 13,
          marginBottom: 5,
        }}
      >
        {label}
      </div>
      <div style={{ fontWeight: 500 }}>{value}</div>
    </div>
  );
}

export default function PatientRecordPage() {
  const router = useRouter();
  const params = useParams();

  const patientId =
    typeof params.id === "string" ? params.id : "";

  const [patient, setPatient] =
    useState<Patient | null>(null);

  const [site, setSite] = useState<Site | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadPatient = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    setPatient(null);
    setSite(null);

    try {
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          patientId
        )
      ) {
        throw new Error("Invalid patient record.");
      }

      // 1. Verify authenticated nurse.
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

      // 2. Load assigned clinic IDs.
      const { data: assignments, error: assignmentError } =
        await supabase
          .from("nurse_site_assignments")
          .select("site_id")
          .eq("nurse_id", userId);

      if (assignmentError) throw assignmentError;

      const siteIds = [
        ...new Set(
          (assignments || []).map(item => item.site_id)
        ),
      ].filter(Boolean);

      if (siteIds.length === 0) {
        throw new Error(
          "No authorised clinic is assigned to your account."
        );
      }

      // 3. Load patient, restricted to assigned sites.
      const { data: record, error: patientError } =

  await supabase
    .from("patients")
    .select(`
      id,
      patient_clinic_id,
      site_id,
      first_name,
      surname,
      id_number,
      passport_number,
      date_of_birth,
      gender,
      mobile_number,
      email,
      address,
      suburb,
      city,
      province,
      postal_code
    `)
    .eq("id", patientId)
    .in("site_id", siteIds)
    .maybeSingle();

if (patientError) {
  throw new Error(patientError.message);
}

if (!record || !record.site_id) {
  throw new Error(
    "Patient not found or access is not authorised."
  );
}


      if (!record || !record.site_id) {
        throw new Error(
          "Patient not found or access is not authorised."
        );
      }

      // 4. Confirm that the clinic is active.
      const { data: clinic, error: siteError } =
        await supabase
          .from("sites")
          .select("id,site_name")
          .eq("id", record.site_id)
          .eq("is_active", true)
          .maybeSingle();

      if (siteError) throw siteError;

      if (!clinic) {
        throw new Error(
          "The patient's clinic is unavailable or inactive."
        );
      }

      setPatient(record as Patient);
      setSite(clinic);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load patient record."
      );
    } finally {
      setLoading(false);
    }
  }, [patientId, router]);

  useEffect(() => {
    void loadPatient();
  }, [loadPatient]);

  if (loading) {
    return (
      <main style={{ padding: 30 }}>
        Loading patient record...
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f0f7f7",
        padding: "28px 16px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 24,
          }}
        >
          <div>
            <h1 style={{ color: "#075c59" }}>
              DoseTrack — Patient Record
            </h1>
            <p style={{ color: "#64748b" }}>
              Family Planning | Clinical Records
            </p>
          </div>

          <button
            type="button"
            style={button}
            onClick={() =>
              router.push("/nurse/dashboard")
            }
          >
            Back to Dashboard
          </button>
        </header>

        {errorMessage && (
          <section style={card}>
            <p role="alert" style={{ color: "#991b1b" }}>
              {errorMessage}
            </p>
            <button
              type="button"
              style={button}
              onClick={() => void loadPatient()}
            >
              Retry
            </button>
          </section>
        )}

        {patient && (
          <>
            <section style={card}>
              <h2 style={{ marginTop: 0 }}>
                Patient Overview
              </h2>

              <h3 style={{ color: "#0f766e" }}>
                {display(patient.first_name)}{" "}
                {display(patient.surname)}
              </h3>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit,minmax(200px,1fr))",
                  gap: 12,
                }}
              >
                <Detail
                  label="Patient Reference"
                  value={display(patient.patient_clinic_id)}
                />
                <Detail
                  label="Clinic"
                  value={display(site?.site_name)}
                />
                <Detail
                  label="Date of Birth"
                  value={formatDate(patient.date_of_birth)}
                />
                <Detail
                  label="Gender"
                  value={display(patient.gender)}
                />
              </div>
            </section>

            <section style={card}>
              <h2>Identification</h2>

              <Detail
                label="South African ID"
                value={display(patient.id_number)}
              />
              <Detail
                label="Passport Number"
                value={display(patient.passport_number)}
              />
            </section>

            <section style={card}>
              <h2>Contact Details</h2>

              <Detail
                label="Contact Number"
                value={display(patient.mobile_number)}
              />
              <Detail
                label="Email Address"
                value={display(patient.email)}
              />
            </section>

            <section style={card}>
              <h2>Residential Address</h2>

              <Detail
                label="Street Address"
                value={display(patient.address)}
              />
              <Detail
                label="Suburb"
                value={display(patient.suburb)}
              />
              <Detail
                label="City / Town"
                value={display(patient.city)}
              />
              <Detail
                label="Province"
                value={display(patient.province)}
              />
              <Detail
                label="Postal Code"
                value={display(patient.postal_code)}
              />
            </section>

            <section style={card}>
              <h2>Family Planning Services</h2>

              <p style={{ color: "#64748b" }}>
                Patient profile loaded. The family planning
                assessment, contraceptive administration
                and follow-up modules will be connected
                here.
              </p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
