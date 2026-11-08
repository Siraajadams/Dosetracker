
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
  province: string | null;
};

type Patient = {
  id: string;
  first_name: string | null;
  surname: string | null;
  date_of_birth: string | null;
};

type DocumentType = "sa_id" | "passport";

const cardStyle: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 22,
  boxShadow: "0 3px 12px rgba(0,0,0,0.04)",
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: 13,
  borderRadius: 9,
  border: "1px solid #cbd5e1",
  boxSizing: "border-box",
  fontSize: 15,
  background: "#ffffff",
};

const primaryButton: CSSProperties = {
  padding: "14px 20px",
  background: "#0f766e",
  color: "white",
  border: "none",
  borderRadius: 9,
  fontWeight: 600,
  fontSize: 15,
  cursor: "pointer",
};

const secondaryButton: CSSProperties = {
  padding: "14px 20px",
  background: "#ffffff",
  color: "#0f766e",
  border: "1px solid #0f766e",
  borderRadius: 9,
  fontWeight: 600,
  cursor: "pointer",
};

export default function NurseDashboardPage() {
  const router = useRouter();

  const [nurseId, setNurseId] = useState("");
  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState("");

  const [documentType, setDocumentType] =
    useState<DocumentType>("sa_id");

  const [documentNumber, setDocumentNumber] =
    useState("");

  const [patient, setPatient] =
    useState<Patient | null>(null);

  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    setMessage("");

    try {
      // 1. Confirm login.
      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError || !auth.user) {
        router.replace("/login");
        return;
      }

      const userId = auth.user.id;

      // 2. Check nurse approval.
      const { data: profile, error: profileError } =
        await supabase
          .from("staff_profiles")
          .select("role,approval_status,is_active")
          .eq("id", userId)
          .maybeSingle();

      if (profileError) throw profileError;

      if (
        !auth.user.email_confirmed_at ||
        !profile ||
        profile.approval_status !== "approved" ||
        profile.is_active !== true
      ) {
        router.replace("/pending-approval");
        return;
      }

      if (profile.role !== "nurse") {
        throw new Error(
          "This dashboard is for approved nurses only."
        );
      }

      setNurseId(userId);

      // 3. Retrieve clinic assignments.
      const { data: assignments, error: assignmentError } =
        await supabase
          .from("nurse_site_assignments")
          .select("site_id")
          .eq("nurse_id", userId);

      if (assignmentError) throw assignmentError;

      const assignedIds = [
        ...new Set(
          (assignments || []).map(row => row.site_id)
        ),
      ];

      if (assignedIds.length === 0) {
        setSites([]);
        setSiteId("");
        setMessage(
          "No clinic has been assigned to your account. Please contact your Super Admin."
        );
        return;
      }

      // 4. Retrieve active clinic details.
      const { data: siteRecords, error: sitesError } =
        await supabase
          .from("sites")
          .select("id,site_name,province")
          .in("id", assignedIds)
          .eq("is_active", true)
          .order("site_name");

      if (sitesError) throw sitesError;

      const activeSites: Site[] = siteRecords || [];

      setSites(activeSites);

      setSiteId(previous =>
        activeSites.some(site => site.id === previous)
          ? previous
          : activeSites.length === 1
            ? activeSites[0].id
            : ""
      );

      if (activeSites.length === 0) {
        setMessage(
          "Your assigned clinics are inactive or unavailable. Contact your Super Admin."
        );
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load nurse dashboard."
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  function selectSite(value: string) {
    setSiteId(value);
    setPatient(null);
    setMessage("");
    setErrorMessage("");
  }

  async function verifySiteAccess(): Promise<boolean> {
    if (!siteId || !nurseId) {
      setErrorMessage("Select a clinic first.");
      return false;
    }

    const { data: auth, error: authError } =
      await supabase.auth.getUser();

    if (authError || auth.user?.id !== nurseId) {
      router.replace("/login");
      return false;
    }

    const { data: profile, error: profileError } =
      await supabase
        .from("staff_profiles")
        .select("role,approval_status,is_active")
        .eq("id", nurseId)
        .maybeSingle();

    if (
      profileError ||
      profile?.role !== "nurse" ||
      profile.approval_status !== "approved" ||
      profile.is_active !== true
    ) {
      setErrorMessage("Your clinical access is not active.");
      return false;
    }

    const { data: assignment, error: assignmentError } =
      await supabase
        .from("nurse_site_assignments")
        .select("site_id")
        .eq("nurse_id", nurseId)
        .eq("site_id", siteId)
        .maybeSingle();

    if (assignmentError || !assignment) {
      setErrorMessage(
        "You are not authorised for this clinic."
      );
      return false;
    }

    const { data: site, error: siteError } =
      await supabase
        .from("sites")
        .select("id")
        .eq("id", siteId)
        .eq("is_active", true)
        .maybeSingle();

    if (siteError || !site) {
      setErrorMessage("Selected clinic is not active.");
      return false;
    }

    return true;
  }

  async function findPatient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (searching) return;

    setPatient(null);
    setMessage("");
    setErrorMessage("");

    const number = documentNumber.trim().toUpperCase();

    if (!number) {
      setErrorMessage("Enter an ID or passport number.");
      return;
    }

    if (
      documentType === "sa_id" &&
      !/^\d{13}$/.test(number)
    ) {
      setErrorMessage(
        "South African ID must contain 13 digits."
      );
      return;
    }

    setSearching(true);

    try {
      const allowed = await verifySiteAccess();

      if (!allowed) return;

      const lookupColumn =
        documentType === "sa_id"
          ? "id_number"
          : "passport_number";

      // Only search patients belonging to the selected site.
      const { data, error } = await supabase
        .from("patients")
        .select(
          "id,first_name,surname,date_of_birth"
        )
        .eq("site_id", siteId)
        .eq(lookupColumn, number)
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setMessage(
          "No patient found at this clinic. You can register a new patient."
        );
        return;
      }

      setPatient(data);
      setMessage("Patient found successfully.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to search for patient."
      );
    } finally {
      setSearching(false);
    }
  }

  async function addPatient() {
    setErrorMessage("");
    setMessage("");

    try {
      const allowed = await verifySiteAccess();

      if (!allowed) return;

      // The Add Patient page must independently
      // verify clinic assignment before saving.
      router.push("/nurse/patients/new");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to open patient registration."
      );
    }
  }

  async function logout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    router.replace("/login");
  }

  const selectedSite = sites.find(
    site => site.id === siteId
  );

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        Loading DoseTrack nurse dashboard...
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
      <div
        style={{
          maxWidth: 950,
          margin: "0 auto",
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 26,
          }}
        >
          <div>
            <h1
              style={{
                color: "#075c59",
                marginBottom: 6,
              }}
            >
              DoseTrack
            </h1>

            <p style={{ color: "#64748b" }}>
              Family Planning | Nurse Dashboard
            </p>
          </div>

          <button
            type="button"
            onClick={() => void logout()}
            style={secondaryButton}
          >
            Logout
          </button>
        </header>

        {errorMessage && (
          <p
            role="alert"
            style={{
              padding: 14,
              borderRadius: 9,
              background: "#fee2e2",
              color: "#991b1b",
              marginBottom: 18,
            }}
          >
            {errorMessage}
          </p>
        )}

        {message && (
          <p
            role="status"
            style={{
              padding: 14,
              borderRadius: 9,
              background: "#e0f2fe",
              color: "#075985",
              marginBottom: 18,
            }}
          >
            {message}
          </p>
        )}

        <section style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>
            Select Clinic
          </h2>

          <p style={{ color: "#64748b" }}>
            Select the clinic where you are providing
            patient care.
          </p>

          <select
            value={siteId}
            onChange={e =>
              selectSite(e.target.value)
            }
            style={inputStyle}
            disabled={sites.length === 0}
            aria-label="Select clinic"
          >
            <option value="">Select Clinic</option>

            {sites.map(site => (
              <option key={site.id} value={site.id}>
                {site.site_name}
                {site.province
                  ? ` — ${site.province}`
                  : ""}
              </option>
            ))}
          </select>

          {selectedSite && (
            <p
              style={{
                marginTop: 14,
                color: "#0f766e",
                fontWeight: 600,
              }}
            >
              Selected: {selectedSite.site_name}
            </p>
          )}

          <button
            type="button"
            onClick={() => void loadDashboard()}
            style={{
              ...secondaryButton,
              marginTop: 15,
            }}
          >
            Refresh Clinics
          </button>
        </section>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(280px,1fr))",
            gap: 18,
            marginTop: 22,
          }}
        >
          <section style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>
              Find Patient
            </h2>

            <p style={{ color: "#64748b" }}>
              Search for a patient using their South
              African ID or passport number.
            </p>

            <form onSubmit={findPatient}>
              <label
                htmlFor="documentType"
                style={{
                  display: "block",
                  fontWeight: 600,
                  marginBottom: 7,
                }}
              >
                Identification Type
              </label>

              <select
                id="documentType"
                value={documentType}
                onChange={e => {
                  setDocumentType(
                    e.target.value as DocumentType
                  );
                  setDocumentNumber("");
                  setPatient(null);
                  setMessage("");
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

              <label
                htmlFor="documentNumber"
                style={{
                  display: "block",
                  fontWeight: 600,
                  marginTop: 16,
                  marginBottom: 7,
                }}
              >
                ID / Passport Number
              </label>

              <input
                id="documentNumber"
                value={documentNumber}
                onChange={e =>
                  setDocumentNumber(
                    e.target.value
                  )
                }
                placeholder="Enter identification number"
                autoComplete="off"
                style={inputStyle}
                required
              />

              <button
                type="submit"
                disabled={
                  searching ||
                  !siteId ||
                  !documentNumber.trim()
                }
                style={{
                  ...primaryButton,
                  marginTop: 18,
                  width: "100%",
                  opacity:
                    searching || !siteId ? 0.6 : 1,
                }}
              >
                {searching
                  ? "Searching..."
                  : "Find Patient"}
              </button>
            </form>

            {patient && (
              <div
                style={{
                  marginTop: 20,
                  padding: 15,
                  background: "#f0fdfa",
                  border: "1px solid #99f6e4",
                  borderRadius: 10,
                }}
              >
                <h3 style={{ marginTop: 0 }}>
                  Patient Found
                </h3>

                <p>
                  <strong>Name:</strong>{" "}
                  {patient.first_name} {patient.surname}
                </p>

                <p>
                  <strong>Date of Birth:</strong>{" "}
                  {patient.date_of_birth || "Not recorded"}
                </p>

                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/nurse/patients/${encodeURIComponent(
                        patient.id
                      )}`
                    )
                  }
                  style={primaryButton}
                >
                  Open Patient Record
                </button>
              </div>
            )}
          </section>

          <section style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>
              Add Patient
            </h2>

            <p style={{ color: "#64748b" }}>
              Register a new patient at your selected
              clinic.
            </p>

            <div
              style={{
                padding: 16,
                borderRadius: 10,
                background: "#f8fafc",
                marginBottom: 20,
              }}
            >
              <p>
                <strong>Clinic:</strong>{" "}
                {selectedSite?.site_name ||
                  "No clinic selected"}
              </p>

              <p style={{ color: "#64748b" }}>
                Patient registration includes
                identification, contact details,
                date of birth and residential address.
              </p>
            </div>

            <button
              type="button"
              disabled={!siteId}
              onClick={() => void addPatient()}
              style={{
                ...primaryButton,
                width: "100%",
                opacity: siteId ? 1 : 0.6,
              }}
            >
              Add New Patient
            </button>
          </section>
        </div>
      </div>
    </main>
  );
}
